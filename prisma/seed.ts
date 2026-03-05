import { PrismaClient } from "../src/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Supabase uses a certificate not trusted by default Node.js CA bundle
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Check your .env.local file.");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const sampleExtractedData = [
  {
    invoiceNumber: "INV-2026-001",
    vendor: "Acme Corp",
    date: "2026-01-15",
    dueDate: "2026-02-15",
    currency: "USD",
    subtotal: 1250.0,
    tax: 125.0,
    total: 1375.0,
    lineItems: [
      { description: "Web Development Services", quantity: 25, unitPrice: 50.0, amount: 1250.0 },
    ],
  },
  {
    invoiceNumber: "INV-2026-002",
    vendor: "CloudHost Inc.",
    date: "2026-02-01",
    dueDate: "2026-03-01",
    currency: "USD",
    subtotal: 499.0,
    tax: 49.9,
    total: 548.9,
    lineItems: [
      { description: "Cloud Hosting - Pro Plan", quantity: 1, unitPrice: 299.0, amount: 299.0 },
      { description: "CDN Bandwidth (500GB)", quantity: 1, unitPrice: 200.0, amount: 200.0 },
    ],
  },
  {
    invoiceNumber: "INV-2026-003",
    vendor: "Office Supplies Ltd.",
    date: "2026-02-20",
    dueDate: "2026-03-20",
    currency: "EUR",
    subtotal: 320.0,
    tax: 64.0,
    total: 384.0,
    lineItems: [
      { description: "Printer Paper (A4, 10 reams)", quantity: 10, unitPrice: 12.0, amount: 120.0 },
      { description: "Ink Cartridges (Color)", quantity: 4, unitPrice: 50.0, amount: 200.0 },
    ],
  },
  {
    invoiceNumber: "INV-2026-004",
    vendor: "Legal Associates LLP",
    date: "2026-03-01",
    dueDate: "2026-04-01",
    currency: "USD",
    subtotal: 3500.0,
    tax: 0,
    total: 3500.0,
    lineItems: [
      { description: "Contract Review", quantity: 5, unitPrice: 400.0, amount: 2000.0 },
      { description: "Compliance Consultation", quantity: 3, unitPrice: 500.0, amount: 1500.0 },
    ],
  },
];

async function main() {
  const userIdArg = process.argv[2];

  let userId: string;

  if (userIdArg) {
    const user = await prisma.user.findUnique({ where: { id: userIdArg } });
    if (!user) {
      console.error(`User with ID "${userIdArg}" not found.`);
      process.exit(1);
    }
    userId = user.id;
    console.log(`Seeding data for user: ${user.email} (${userId})`);
  } else {
    const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (!user) {
      console.error("No users found in the database. Sign up first, then run the seed.");
      process.exit(1);
    }
    userId = user.id;
    console.log(`Seeding data for first user: ${user.email} (${userId})`);
  }

  const now = new Date();

  const invoices = [
    {
      userId,
      fileName: "acme-corp-january.pdf",
      fileUrl: "invoices/acme-corp-january.pdf",
      status: "COMPLETED" as const,
      extractedData: sampleExtractedData[0],
      uploadedAt: new Date("2026-01-15T10:30:00Z"),
      processingStartedAt: new Date("2026-01-15T10:30:05Z"),
      processedAt: new Date("2026-01-15T10:30:12Z"),
    },
    {
      userId,
      fileName: "cloudhost-february.pdf",
      fileUrl: "invoices/cloudhost-february.pdf",
      status: "COMPLETED" as const,
      extractedData: sampleExtractedData[1],
      uploadedAt: new Date("2026-02-01T14:00:00Z"),
      processingStartedAt: new Date("2026-02-01T14:00:03Z"),
      processedAt: new Date("2026-02-01T14:00:15Z"),
    },
    {
      userId,
      fileName: "office-supplies-receipt.pdf",
      fileUrl: "invoices/office-supplies-receipt.pdf",
      status: "COMPLETED" as const,
      extractedData: sampleExtractedData[2],
      uploadedAt: new Date("2026-02-20T09:15:00Z"),
      processingStartedAt: new Date("2026-02-20T09:15:02Z"),
      processedAt: new Date("2026-02-20T09:15:08Z"),
    },
    {
      userId,
      fileName: "legal-review-march.pdf",
      fileUrl: "invoices/legal-review-march.pdf",
      status: "PROCESSING" as const,
      extractedData: null,
      uploadedAt: new Date(now.getTime() - 60_000),
      processingStartedAt: new Date(now.getTime() - 55_000),
      processedAt: null,
    },
    {
      userId,
      fileName: "freelancer-payment.png",
      fileUrl: "invoices/freelancer-payment.png",
      status: "PENDING" as const,
      extractedData: null,
      uploadedAt: now,
      processingStartedAt: null,
      processedAt: null,
    },
    {
      userId,
      fileName: "corrupted-scan.jpg",
      fileUrl: "invoices/corrupted-scan.jpg",
      status: "FAILED" as const,
      extractedData: null,
      errorMessage: "Failed to extract text from image. The document appears to be too blurry or damaged.",
      uploadedAt: new Date("2026-02-10T16:45:00Z"),
      processingStartedAt: new Date("2026-02-10T16:45:03Z"),
      processedAt: new Date("2026-02-10T16:45:10Z"),
    },
  ];

  console.log(`Creating ${invoices.length} seed invoices...`);

  for (const invoice of invoices) {
    await prisma.invoice.create({ data: invoice });
  }

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
