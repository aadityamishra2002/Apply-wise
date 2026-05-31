export type Job = {
  id: string;
  company: string;
  initials: string;
  title: string;
  location: string;
  mode: string;
  salary: string;
  match: number;
  posted: string;
  description: string;
  matching: string[];
  missing: string[];
  saved?: boolean;
};

export const jobs: Job[] = [
  {
    id: "linear-product",
    company: "Linear",
    initials: "L",
    title: "Senior Product Engineer",
    location: "San Francisco, CA",
    mode: "Remote",
    salary: "$175k - $220k",
    match: 94,
    posted: "1d ago",
    description:
      "Build and refine product experiences that help modern software teams plan and ship exceptional work. You will own meaningful product areas from early exploration through launch.",
    matching: ["React", "TypeScript", "Product strategy", "PostgreSQL", "SaaS"],
    missing: ["GraphQL"],
    saved: true,
  },
  {
    id: "notion-ai",
    company: "Notion",
    initials: "N",
    title: "Full-Stack Engineer, AI Platform",
    location: "New York, NY",
    mode: "Hybrid",
    salary: "$165k - $205k",
    match: 89,
    posted: "2d ago",
    description:
      "Ship AI-assisted collaboration features and platform capabilities used by millions of people. Partner closely with product, design, and applied AI teams.",
    matching: ["React", "TypeScript", "Python", "AI products", "FastAPI"],
    missing: ["Redis", "LLM evaluation"],
  },
  {
    id: "ramp-product",
    company: "Ramp",
    initials: "R",
    title: "Product Engineer",
    location: "Remote, US",
    mode: "Remote",
    salary: "$150k - $190k",
    match: 86,
    posted: "3d ago",
    description:
      "Own customer-facing workflows end to end for a fast-growing financial operations platform. Build fast, learn from users, and raise the product quality bar.",
    matching: ["React", "TypeScript", "Analytics", "SQL", "Product ownership"],
    missing: ["Fintech"],
  },
  {
    id: "vercel-backend",
    company: "Vercel",
    initials: "V",
    title: "Backend Engineer, Platform",
    location: "Remote",
    mode: "Remote",
    salary: "$155k - $210k",
    match: 78,
    posted: "4d ago",
    description:
      "Design reliable platform services that power frontend teams around the world. Improve observability, performance, and developer experience at scale.",
    matching: ["Python", "PostgreSQL", "Docker", "Platform"],
    missing: ["Kubernetes", "Redis"],
  },
];

export const applications = [
  { company: "Arc", title: "Senior Product Engineer", status: "Applied", date: "May 28", match: 91 },
  { company: "Figma", title: "Product Engineer, Growth", status: "Interview", date: "May 24", match: 88 },
  { company: "Stripe", title: "Full-Stack Engineer", status: "Interview", date: "May 22", match: 86 },
  { company: "Mercury", title: "Software Engineer", status: "Saved", date: "May 21", match: 84 },
  { company: "Webflow", title: "Frontend Engineer", status: "Applied", date: "May 18", match: 82 },
];

export const boardApplications = [
  { id: "1", company: "Mercury", title: "Software Engineer", status: "Saved", match: 84, date: "May 21" },
  { id: "2", company: "Linear", title: "Senior Product Engineer", status: "Preparing", match: 94, date: "Today" },
  { id: "3", company: "Arc", title: "Senior Product Engineer", status: "Applied", match: 91, date: "May 28" },
  { id: "4", company: "Webflow", title: "Frontend Engineer", status: "Applied", match: 82, date: "May 18" },
  { id: "5", company: "Figma", title: "Product Engineer, Growth", status: "Interview", match: 88, date: "Jun 2" },
  { id: "6", company: "Stripe", title: "Full-Stack Engineer", status: "Interview", match: 86, date: "Jun 5" },
  { id: "7", company: "Airbnb", title: "Software Engineer", status: "Rejected", match: 72, date: "May 12" },
];

