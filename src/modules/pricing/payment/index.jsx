"use client";
import { useState } from "react";
import Link from "next/link";
import { Sparkle, Check, Loader2, Zap, Star } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

const SUBSCRIPTION_PLANS = [
  {
    id: "plan-creator",
    title: "Creator",
    tag: "normal",
    price: "Rs. 21,999",
    priceNum: 21999,
    type: "per year",
    tax: "(+GST Applicable)",
    buttonName: "Go Creator",
    description: "100,000 Credits",
    credits: 100_000,
    points: [
      "No watermark",
      "Unlimited Auto Subtitles",
      "Full audio & video catalog",
      "Gen-AI Studio videos with Credits",
    ],
  },
  {
    id: "plan-pro",
    title: "Pro",
    tag: "Recommended",
    price: "Rs. 46,999",
    priceNum: 46999,
    type: "per year",
    tax: "(+GST Applicable)",
    buttonName: "Go Pro",
    description: "150,000 Credits",
    credits: 150_000,
    points: [
      "Everything in Creator +",
      "Multiple Brand Kits",
      "Translate to 50+ Languages",
      "Up to 144 hr/yr of AI voice",
      "5x more Gen-AI Studio videos than Creator",
    ],
  },
  {
    id: "plan-studio",
    title: "Studio",
    tag: "normal",
    price: "Rs. 74,999",
    priceNum: 74999,
    type: "per year",
    tax: "(+GST Applicable)",
    buttonName: "Go Studio",
    description: "300,000 Credits",
    credits: 300_000,
    points: [
      "Everything in Pro +",
      "Custom Templates",
      "12 hr/yr of Translations",
      "Up to 960 hr/yr of AI voice",
      "6x more Gen-AI Studio videos than Pro",
    ],
  },
  {
    id: "plan-enterprise",
    title: "Enterprise",
    tag: "normal",
    price: "",
    priceNum: 0,
    type: "Custom Pricing",
    tax: "(+GST Applicable)",
    buttonName: "Contact Sales",
    description: "Custom AI Credits",
    credits: 0,
    points: [
      "Custom AI Credits",
      "Centrally manage teams and data",
      "Review mode for videos",
      "Privacy controls",
      "Customer success",
    ],
  },
];

function Toast({ message, type, onClose }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-4 shadow-2xl text-sm font-medium
        ${type === "success" ? "bg-green-700 text-white" : "bg-red-600 text-white"}`}
    >
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
}

// Dynamically load Razorpay SDK only when initiating a payment
function loadRazorpayScript() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ---------------------------------------------------------------------------
// Shared payment initiator — works for both subscription plans and credit packs
// ---------------------------------------------------------------------------
function useRazorpay() {
  const { data: session, refetch } = useSession();
  const router = useRouter();
  const [loadingItem, setLoadingItem] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 6000);
  };

  const initiatePayment = async (itemId, description) => {
    // Guard: must be logged in
    if (!session) {
      router.push("/auth/signin?callbackUrl=/pricing");
      return;
    }

    setLoadingItem(itemId);

    try {
      // STEP 1: Create the Razorpay order via our Next.js API proxy (which forwards the auth_token cookie to the Express backend)
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to create order");
      }

      const order = await res.json();

      // Dev mock mode: Razorpay keys aren't set yet
      if (order.isMock) {
        showToast(`[DEV MODE] Mock order created (${order.orderId}). Fill in RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET to test real payments.`);
        setLoadingItem(null);
        return;
      }

      // STEP 2: Dynamically load Razorpay SDK on-demand only when creating order
      const loaded = await loadRazorpayScript();
      if (!loaded || typeof window.Razorpay === "undefined") {
        throw new Error("Failed to load Razorpay SDK. Please check your internet connection.");
      }

      const rzp = new window.Razorpay({
        key: order.keyId,           // your PUBLIC key (rzp_test_xxx / rzp_live_xxx)
        order_id: order.orderId,    // the order ID from Razorpay
        amount: order.amount,       // in paise
        currency: order.currency,
        name: "Thumbplay AI",
        description,
        image: "/favicon.ico",
        prefill: {
          email: session?.user?.email || "",
          name: session?.user?.name || "",
        },
        theme: { color: "#000000" },

        // STEP 3: Verify payment with backend & grant credits / update plan immediately
        handler: async function (response) {
          try {
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            const data = await verifyRes.json();
            if (data.success) {
              showToast(`🎉 Payment successful! Added ${data.creditsAdded || ''} credits to your account.`, "success");
              refetch?.();
            } else {
              showToast(data.error || "Payment verification failed", "error");
            }
          } catch (err) {
            console.error("Payment verification error:", err);
            showToast("🎉 Payment successful! Updating credits...", "success");
            refetch?.();
          } finally {
            setLoadingItem(null);
          }
        },

        modal: {
          ondismiss: function () {
            setLoadingItem(null);
          },
        },
      });

      rzp.on("payment.failed", function (response) {
        showToast(`Payment failed: ${response.error.description}`, "error");
        setLoadingItem(null);
      });

      rzp.open();
    } catch (err) {
      showToast(err.message || "Something went wrong. Please try again.", "error");
      setLoadingItem(null);
    }
  };

  return { initiatePayment, loadingItem, toast, clearToast: () => setToast(null) };
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------
export default function Payment() {
  const { initiatePayment, loadingItem, toast, clearToast } = useRazorpay();

  return (
    <main className="py-12 px-4 sm:px-6 overflow-x-hidden">
      {/* Header */}
      <div className="py-4 flex gap-2 sm:gap-4 flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-semibold sm:text-5xl lg:text-6xl leading-tight">
          Great videos start with a plan
        </h1>
        <span className="text-sm sm:text-base text-neutral-600 flex flex-wrap items-center justify-center gap-1">
          upgrade to get powerful features.
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Subscription plans                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap justify-center gap-4 py-8 sm:py-12">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isEnterprise = plan.id === "plan-enterprise";
          const isLoading = loadingItem === plan.id;

          return (
            <div key={plan.id} className="relative group w-full max-w-sm sm:w-72">
              {/* Soft Glow */}
              <div className="absolute inset-x-6 -bottom-6 h-10 rounded-full bg-black/10 blur-2xl opacity-60 transition-all duration-300 group-hover:opacity-100 group-hover:blur-3xl group-hover:-bottom-7" />

              {/* Card */}
              <div
                className={`relative flex flex-col w-full rounded-3xl bg-white p-6
                  transition-all duration-300 hover:-translate-y-2
                  hover:shadow-[0_20px_40px_rgba(0,0,0,0.08),0_40px_80px_rgba(0,0,0,0.12)]
                  ${plan.tag === "Recommended"
                    ? "ring-1 ring-[#c7f038]/40 shadow-[0_12px_30px_rgba(199,240,56,0.18),0_30px_80px_rgba(0,0,0,0.10)]"
                    : ""
                  }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold tracking-tight">{plan.title}</h2>
                  {plan.tag === "Recommended" && (
                    <span className="rounded-full bg-[#c7f038] px-4 py-1 text-xs font-medium text-black">
                      {plan.tag}
                    </span>
                  )}
                </div>

                {/* Price */}
                <div className="py-6">
                  <div className="flex items-end gap-1">
                    {plan.price && (
                      <span className="text-2xl font-bold tracking-tight">{plan.price}</span>
                    )}
                    {plan.type && (
                      <span className="pb-1 text-sm text-neutral-500">{plan.type}</span>
                    )}
                  </div>
                  {plan.tax && (
                    <p className="mt-1 text-xs text-neutral-500">{plan.tax}</p>
                  )}
                </div>

                {/* CTA Button */}
                {isEnterprise ? (
                  <a
                    id={`plan-${plan.id}`}
                    href="mailto:sales@thumbpin.in"
                    className="rounded-full bg-black py-3 text-center text-sm font-medium text-white transition-all duration-300 hover:scale-[1.03] hover:bg-neutral-800 active:scale-100"
                  >
                    {plan.buttonName}
                  </a>
                ) : (
                  <button
                    id={`plan-${plan.id}`}
                    onClick={() => initiatePayment(plan.id, `${plan.title} Plan — ${plan.description}`)}
                    disabled={isLoading || loadingItem !== null}
                    className="rounded-full bg-black py-3 text-center text-sm font-medium text-white transition-all duration-300 hover:scale-[1.03] hover:bg-neutral-800 active:scale-100 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Processing…
                      </>
                    ) : (
                      plan.buttonName
                    )}
                  </button>
                )}

                {/* Divider */}
                <div className="my-6 h-px bg-neutral-200" />

                {/* Credits description */}
                <div className="flex items-start gap-2">
                  <Sparkle size={18} className="mt-0.5 shrink-0 text-neutral-700" />
                  <p className="text-sm leading-6 text-neutral-600">{plan.description}</p>
                </div>

                {/* Features */}
                <ul className="mt-6 space-y-4">
                  {plan.points.map((point, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100">
                        <Check size={12} />
                      </div>
                      <span className="text-sm leading-6 text-neutral-600">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}
    </main>
  );
}
