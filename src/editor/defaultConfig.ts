import type { NeucliConfig } from './types';

const sharedNavbar = (activeLinks: Array<{ label: string; href: string }>) => ({
  type: 'navbar' as const,
  className: 'bg-slate-900 text-white',
  props: { brand: 'Acme Inc.', links: activeLinks },
});

const sharedFooter = (links: Array<{ label: string; href: string }>) => ({
  type: 'footer' as const,
  className: 'bg-slate-900 text-slate-300',
  props: { text: '\u00a9 2026 Acme Inc. All rights reserved.', links },
});

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'About', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
];

const FOOTER_LINKS = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'GitHub', href: 'https://github.com' },
  { label: 'Twitter', href: 'https://twitter.com' },
];

export const DEFAULT_CONFIG: NeucliConfig = {
  meta: {
    name: 'Acme Inc.',
    description: 'Premium digital products — built with neucli',
    lang: 'en',
    favicon: '/favicon.svg',
  },
  theme: {
    colors: { primary: '#6366f1', secondary: '#0ea5e9', accent: '#f59e0b' },
    fonts: { heading: 'Inter', body: 'Inter' },
  },
  pages: [
    {
      path: '/',
      name: 'Home',
      title: 'Acme Inc. — Build Something Great',
      meta: { description: 'Premium tools for modern teams. Ship faster, build better.' },
      sections: [
        sharedNavbar(NAV_LINKS),
        {
          type: 'hero',
          className: 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white',
          props: {
            title: 'Ship products 10x faster',
            subtitle: 'The all-in-one platform for modern teams. Design, build, and deploy without the hassle.',
          },
          children: [
            { type: 'button', className: 'bg-white text-indigo-700 px-8 py-3.5 rounded-xl font-bold shadow-lg hover:shadow-xl transition', props: { label: 'Start free trial', href: '/pricing' } },
            { type: 'button', className: 'border-2 border-white/40 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-white/10 transition', props: { label: 'Watch demo', href: '#' } },
          ],
        },
        {
          type: 'section',
          className: 'bg-white',
          props: { title: 'Trusted by 10,000+ teams worldwide' },
          children: [
            {
              type: 'grid', className: 'mt-4', props: { columns: 4 },
              children: [
                { type: 'text', className: 'text-center text-3xl font-bold text-indigo-600', props: { tag: 'p', content: '10K+' } },
                { type: 'text', className: 'text-center text-3xl font-bold text-indigo-600', props: { tag: 'p', content: '99.9%' } },
                { type: 'text', className: 'text-center text-3xl font-bold text-indigo-600', props: { tag: 'p', content: '150+' } },
                { type: 'text', className: 'text-center text-3xl font-bold text-indigo-600', props: { tag: 'p', content: '24/7' } },
              ],
            },
            {
              type: 'grid', className: '-mt-4', props: { columns: 4 },
              children: [
                { type: 'text', className: 'text-center text-sm text-slate-500', props: { tag: 'p', content: 'Active teams' } },
                { type: 'text', className: 'text-center text-sm text-slate-500', props: { tag: 'p', content: 'Uptime SLA' } },
                { type: 'text', className: 'text-center text-sm text-slate-500', props: { tag: 'p', content: 'Countries' } },
                { type: 'text', className: 'text-center text-sm text-slate-500', props: { tag: 'p', content: 'Support' } },
              ],
            },
          ],
        },
        {
          type: 'section',
          className: 'bg-slate-50',
          props: { title: 'Everything you need to build' },
          children: [{
            type: 'grid', props: { columns: 3 },
            children: [
              { type: 'card', className: 'rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition', props: { title: 'Visual Builder', description: 'Drag-and-drop interface to design pages. No code required — just your imagination.', image: 'https://placehold.co/800x400/6366f1/white?text=Visual+Builder' } },
              { type: 'card', className: 'rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition', props: { title: 'One-Click Deploy', description: 'Push to production in seconds. Automatic SSL, CDN, and edge caching built in.', image: 'https://placehold.co/800x400/0ea5e9/white?text=Deploy' } },
              { type: 'card', className: 'rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition', props: { title: 'Team Collaboration', description: 'Real-time editing, comments, and version history. Work together seamlessly.', image: 'https://placehold.co/800x400/f59e0b/white?text=Collaborate' } },
            ],
          }],
        },
        {
          type: 'section',
          className: 'bg-indigo-600 text-white',
          props: { title: 'Ready to get started?' },
          children: [
            { type: 'text', className: 'text-lg opacity-90 -mt-4 mb-8', props: { tag: 'p', content: 'Join thousands of teams already building with Acme. Free 14-day trial, no credit card required.' } },
            {
              type: 'container', className: 'flex gap-4 justify-center',
              children: [
                { type: 'button', className: 'bg-white text-indigo-700 px-8 py-3 rounded-lg font-bold hover:bg-indigo-50 transition', props: { label: 'Start building', href: '/pricing' } },
                { type: 'button', className: 'border-2 border-white/30 text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition', props: { label: 'Talk to sales', href: '/contact' } },
              ],
            },
          ],
        },
        sharedFooter(FOOTER_LINKS),
      ],
    },
    {
      path: '/pricing',
      name: 'Pricing',
      title: 'Pricing — Acme Inc.',
      meta: { description: 'Simple, transparent pricing for teams of all sizes.' },
      sections: [
        sharedNavbar([{ label: 'Features', href: '/#features' }, { label: 'Pricing', href: '/pricing' }, { label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }]),
        { type: 'hero', className: 'bg-white text-slate-900', props: { title: 'Simple, transparent pricing', subtitle: 'No hidden fees. No surprises. Pick a plan and start building today.' } },
        {
          type: 'section', className: 'bg-slate-50 -mt-8', props: { title: '' },
          children: [{
            type: 'grid', props: { columns: 3 },
            children: [
              { type: 'card', className: 'rounded-2xl border border-slate-200 bg-white p-0 shadow-sm', props: { title: 'Starter', description: 'Perfect for side projects and personal sites. Includes 1 project, 1GB storage, and community support.', image: 'https://placehold.co/800x100/f0f0f0/999?text=FREE' }, children: [{ type: 'button', className: 'w-full bg-slate-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-800 transition', props: { label: 'Get started free', href: '#' } }] },
              { type: 'card', className: 'rounded-2xl border-2 border-indigo-500 bg-white p-0 shadow-lg ring-4 ring-indigo-500/10', props: { title: 'Pro', description: 'For growing teams. Unlimited projects, 100GB storage, priority support, custom domains, and analytics.', image: 'https://placehold.co/800x100/6366f1/white?text=$29/mo' }, children: [{ type: 'button', className: 'w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-500 transition shadow-md', props: { label: 'Start 14-day trial', href: '#' } }] },
              { type: 'card', className: 'rounded-2xl border border-slate-200 bg-white p-0 shadow-sm', props: { title: 'Enterprise', description: 'For large organizations. SSO, audit logs, SLA, dedicated account manager, and unlimited everything.', image: 'https://placehold.co/800x100/f0f0f0/999?text=Custom' }, children: [{ type: 'button', className: 'w-full bg-slate-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-800 transition', props: { label: 'Contact sales', href: '/contact' } }] },
            ],
          }],
        },
        sharedFooter([{ label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' }]),
      ],
    },
    {
      path: '/about',
      name: 'About',
      title: 'About Us — Acme Inc.',
      meta: { description: 'Learn about our mission to empower modern teams.' },
      sections: [
        sharedNavbar([{ label: 'Home', href: '/' }, { label: 'Pricing', href: '/pricing' }, { label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }]),
        { type: 'hero', className: 'bg-gradient-to-r from-slate-900 to-slate-700 text-white', props: { title: 'Our mission', subtitle: 'We believe every team deserves great tools. Acme was founded in 2022 with a simple goal: make building for the web effortless.' } },
        {
          type: 'section', className: 'bg-white', props: { title: 'Our story' },
          children: [
            { type: 'text', className: 'text-lg text-slate-600 leading-relaxed max-w-3xl', props: { tag: 'p', content: 'What started as a weekend hack project quickly grew into a platform used by thousands of teams worldwide. Our founders — a designer and two engineers — were frustrated by the gap between design and development. So they built a bridge.' } },
            { type: 'image', className: 'rounded-2xl shadow-lg mt-8', props: { src: 'https://placehold.co/1200x500/1e293b/white?text=Our+Team', alt: 'The Acme team' } },
          ],
        },
        {
          type: 'section', className: 'bg-slate-50', props: { title: 'Our values' },
          children: [{
            type: 'grid', props: { columns: 3 },
            children: [
              { type: 'card', className: 'rounded-xl bg-white border border-slate-200 shadow-sm', props: { title: 'Ship fast', description: 'We optimize for speed. Every feature should get from idea to production in days, not months.' } },
              { type: 'card', className: 'rounded-xl bg-white border border-slate-200 shadow-sm', props: { title: 'Stay simple', description: 'Complexity is the enemy. We relentlessly cut scope until only the essential remains.' } },
              { type: 'card', className: 'rounded-xl bg-white border border-slate-200 shadow-sm', props: { title: 'Be open', description: 'Open source, open roadmap, open communication. Transparency builds trust.' } },
            ],
          }],
        },
        sharedFooter([{ label: 'Home', href: '/' }, { label: 'Privacy', href: '/privacy' }]),
      ],
    },
    {
      path: '/blog',
      name: 'Blog',
      title: 'Blog — Acme Inc.',
      meta: { description: 'Insights, tutorials, and updates from the Acme team.' },
      sections: [
        sharedNavbar([{ label: 'Home', href: '/' }, { label: 'Pricing', href: '/pricing' }, { label: 'Blog', href: '/blog' }, { label: 'Contact', href: '/contact' }]),
        { type: 'hero', className: 'bg-white text-slate-900', props: { title: 'Blog', subtitle: 'Insights, tutorials, and product updates from our team.' } },
        {
          type: 'section', className: 'bg-slate-50', props: { title: 'Latest posts' },
          children: [{
            type: 'grid', props: { columns: 3 },
            children: [
              { type: 'card', className: 'rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer', props: { title: 'Introducing Acme 2.0', description: 'A complete redesign from the ground up. Faster builds, better DX, and a stunning new editor.', image: 'https://placehold.co/800x400/6366f1/white?text=Acme+2.0' } },
              { type: 'card', className: 'rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer', props: { title: 'How we scaled to 10K teams', description: 'The infrastructure decisions, trade-offs, and lessons we learned growing from 0 to 10,000 customers.', image: 'https://placehold.co/800x400/0ea5e9/white?text=Scale' } },
              { type: 'card', className: 'rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer', props: { title: 'Design systems done right', description: 'Why consistency matters and how to build a design system that actually gets used by your team.', image: 'https://placehold.co/800x400/f59e0b/white?text=Design+Systems' } },
            ],
          }],
        },
        sharedFooter([{ label: 'Home', href: '/' }, { label: 'RSS', href: '/rss.xml' }]),
      ],
    },
    {
      path: '/contact',
      name: 'Contact',
      title: 'Contact Us — Acme Inc.',
      meta: { description: 'Get in touch with the Acme team.' },
      sections: [
        sharedNavbar([{ label: 'Home', href: '/' }, { label: 'Pricing', href: '/pricing' }, { label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }]),
        { type: 'hero', className: 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white', props: { title: 'Get in touch', subtitle: 'Have questions? Want a demo? We would love to hear from you.' } },
        {
          type: 'section', className: 'bg-white', props: { title: 'Contact information' },
          children: [{
            type: 'grid', props: { columns: 2 },
            children: [
              {
                type: 'container', className: 'space-y-6',
                children: [
                  { type: 'text', className: 'text-lg text-slate-600', props: { tag: 'p', content: 'Email us at hello@acme.inc or fill out the form. We typically respond within 24 hours.' } },
                  { type: 'text', className: 'text-sm text-slate-500', props: { tag: 'p', content: '123 Innovation Drive, San Francisco, CA 94107' } },
                  { type: 'text', className: 'text-sm text-slate-500', props: { tag: 'p', content: 'Phone: +1 (555) 123-4567' } },
                ],
              },
              {
                type: 'container', className: 'rounded-xl border border-slate-200 bg-slate-50 p-8 space-y-4',
                children: [
                  { type: 'text', className: 'text-xl font-bold text-slate-900', props: { tag: 'h3', content: 'Send us a message' } },
                  { type: 'text', className: 'text-sm text-slate-500', props: { tag: 'p', content: 'Name' } },
                  { type: 'text', className: 'text-sm text-slate-500', props: { tag: 'p', content: 'Email' } },
                  { type: 'text', className: 'text-sm text-slate-500', props: { tag: 'p', content: 'Message' } },
                  { type: 'button', className: 'bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-500 transition w-full', props: { label: 'Send message', href: '#' } },
                ],
              },
            ],
          }],
        },
        sharedFooter([{ label: 'Home', href: '/' }, { label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' }]),
      ],
    },
  ],
};
