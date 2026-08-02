// Central registry for the Creative Ad Generator's templates — mirrors
// src/lib/templates.js but for static assets instead of video reels.
// Empty for now; entries get added the same shape as TEMPLATES once the
// creative flow is designed.

export const CREATIVE_TEMPLATES = [
  {
    slug: "art-of-living",
    title: "Art of Living",
    category: "real-estate",
    image: "https://content.thumbpin.in/creatives/art_of_living.jpg",
    tag: "New",
    href: null,
  },
];

export function getAllCreativeTemplates() {
  return CREATIVE_TEMPLATES.filter((t) => !t.hidden);
}

export function getCreativeTemplateBySlug(slug) {
  return CREATIVE_TEMPLATES.find((t) => t.slug === slug);
}
