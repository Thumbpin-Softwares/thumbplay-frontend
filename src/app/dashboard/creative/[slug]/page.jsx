import { notFound } from "next/navigation";
import { getAllCreativeTemplates, getCreativeTemplateBySlug } from "@/lib/creative-templates";
import CreativeAdGenerator from "@/modules/creative-ad-generator";

export function generateStaticParams() {
  return getAllCreativeTemplates().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const template = getCreativeTemplateBySlug(slug);
  if (!template) return {};
  return { title: `${template.title} - Thumbplay.ai` };
}

export default async function CreativeTemplatePage({ params }) {
  const { slug } = await params;
  const template = getCreativeTemplateBySlug(slug);
  if (!template) notFound();

  return <CreativeAdGenerator template={template} />;
}
