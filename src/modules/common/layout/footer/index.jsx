import LargeText from "../../components/large-text";
import { FaXTwitter, FaYoutube, FaInstagram } from "react-icons/fa6";
import Link from "next/link";
import { RectangleGoggles } from "lucide-react";

export default function Footer() {
  return (
    <main className="w-full rounded-t-[40px] sm:rounded-t-[80px] p-6 sm:p-8 lg:p-6 bg-neutral-700">
      <div className="flex flex-col lg:flex-row items-start justify-between gap-10 lg:gap-0 pt-8 lg:pt-12 px-2 sm:px-6 lg:px-12">
        <div className="flex flex-col items-start justify-between gap-8 lg:h-72">
          <div className="flex gap-2">
            <Link href="" className="p-2 border border-white rounded-full">
              <FaXTwitter className="text-white text-lg" />
            </Link>
            <Link href="" className="p-2 border border-white rounded-full">
              <FaYoutube className="text-white text-lg" />
            </Link>
            <Link href="" className="p-2 border border-white rounded-full">
              <FaInstagram className="text-white text-lg" />
            </Link>
          </div>

          <div className="flex flex-col gap-4 items-start justify-center">
            <div className="flex gap-4 items-center justify-center">
              <div className="p-4 bg-black rounded-full shrink-0">
                <RectangleGoggles size={32} fill="#c7f038" />
              </div>
              <span className="text-neutral-400 max-w-64 lg:w-42 text-xs">
                The easy way to create stunning real estate video Ad, add
                subtitles and grow your audience.
              </span>
            </div>
            <span className="text-neutral-400 text-sm tracking-tight">
              @Copyright 2026 Thumbplay.ai
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-row gap-8 w-full lg:w-auto">
          <div className="flex flex-col items-start gap-2">
            <h1 className="text-lg font-semibold text-white">Video Generator</h1>
            <Link href="" className="text-neutral-400 text-sm">Frustrated Anchor</Link>
            <Link href="" className="text-neutral-400 text-sm">Model Exiting Luxury Vehicle</Link>
            <Link href="" className="text-neutral-400 text-sm">Action Packed Property Reveal</Link>
          </div>

          <div className="flex flex-col items-start gap-2">
            <h1 className="text-lg font-semibold text-white">Product</h1>
            <Link href="" className="text-neutral-400 text-sm">Pricing</Link>
            <Link href="" className="text-neutral-400 text-sm">Usage</Link>
            <Link href="" className="text-neutral-400 text-sm">Ad Generator</Link>
            <Link href="" className="text-neutral-400 text-sm">Ad Editor</Link>
          </div>

          <div className="flex flex-col items-start gap-2 col-span-2 sm:col-span-1">
            <h1 className="text-lg font-semibold text-white">Resources</h1>
            <Link href="" className="text-neutral-400 text-sm">Blog</Link>
            <Link href="" className="text-neutral-400 text-sm">Video Guides</Link>
            <Link href="" className="text-neutral-400 text-sm">Live</Link>
            <Link href="" className="text-neutral-400 text-sm">Documentation</Link>
          </div>
        </div>
      </div>
      <div className="flex justify-center items-center overflow-hidden">
        <LargeText />
      </div>
    </main>
  );
}
