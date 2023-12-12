import { PrismaClient } from '@prisma/client';
import cuid from 'cuid';

const prisma = new PrismaClient();

// User Data
const users = [
  {
    id: cuid(),
    name: 'John Doe1',
    email: 'johndoe1@example.com',
    password: 'password123',
  },
  {
    id: cuid(),
    name: 'Jane Doe2',
    email: 'janedoe2@example.com',
    password: 'password456',
  },
  // Add more user data as needed
];

// Customer Data
const customers = [
  {
    id: cuid(),
    name: 'Customer 1',
    email: 'customer1@example.com',
    image_url: 'https://example.com/image1.jpg',
  },
  {
    id: cuid(),
    name: 'Customer 2',
    email: 'customer2@example.com',
    image_url: 'https://example.com/image1.jpg',
  },
  // Add more customer data as needed
];

// Invoice Data
const invoices = [
  {
    id: cuid(),
    customer_id: customers[0].id,
    amount: 100.0,
    status: 'paid',
    date: new Date('2023-12-01'),
  },
  {
    id: cuid(),
    customer_id: customers[0].id,
    amount: 50.0,
    status: 'pending',
    date: new Date('2023-12-10'),
  },
  {
    id: cuid(),
    customer_id: customers[1].id,
    amount: 75.0,
    status: 'paid',
    date: new Date('2023-12-05'),
  },
  // Add more invoice data as needed
];

// Revenue Data
const revenues = [
  {
    id: cuid(),
    month: 'January',
    revenue: 500.0,
  },
  {
    id: cuid(),
    month: 'February',
    revenue: 750.0,
  },
  {
    id: cuid(),
    month: 'March',
    revenue: 1000.0,
  },
  // Add more revenue data as needed
];

async function main() {
  try {
    await prisma.user.createMany({
      data: users,
    });

    await prisma.customer.createMany({
      data: customers,
    });

    await prisma.invoice.createMany({
      data: invoices,
    });

    await prisma.revenue.createMany({
      data: revenues,
    });

    console.log('Seed data created successfully!');
  } catch (error) {
    console.error('Error seeding the database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
