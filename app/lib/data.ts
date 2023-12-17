import { sql } from '@vercel/postgres';
import { unstable_noStore as noStore } from 'next/cache';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  User,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';
import prisma from './prisma';

export async function fetchRevenue() {
  noStore();

  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    console.log('Fetching revenue data...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await prisma.revenue.findMany();

    console.log('Data fetch completed after 3 seconds.');

    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  noStore();
  try {
    const data = await prisma.invoice.findMany({
      select: {
        amount: true,
        customer: {
          select: {
            name: true,
            image_url: true,
            email: true,
          },
        },
        id: true,
      },
      orderBy: {
        date: 'desc',
      },
      take: 5,
    });

    // Process the result to flatten the structure
    const invoices = data.map((invoice) => ({
      amount: invoice.amount,
      name: invoice.customer.name,
      image_url: invoice.customer.image_url,
      email: invoice.customer.email,
      id: invoice.id,
    }));

    const latestInvoices = invoices.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  noStore();
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoiceStatusPromise = prisma.invoice.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        OR: [{ status: 'paid' }, { status: 'pending' }],
      },
    });

    const [numberOfInvoices, numberOfCustomers, invoiceStatus] =
      await Promise.all([
        prisma.invoice.count(),
        prisma.customer.count(),
        invoiceStatusPromise,
      ]);

    const totalPaidInvoices = formatCurrency(invoiceStatus._sum.amount ?? 0);
    const totalPendingInvoices = formatCurrency(
      numberOfInvoices - (invoiceStatus._sum.amount ?? 0),
    );

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  noStore();
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoicesWithCustomers = await prisma.invoice.findMany({
      where: {
        OR: [
          { customer: { name: { contains: query, mode: 'insensitive' } } },
          { customer: { email: { contains: query, mode: 'insensitive' } } },
          { amount: { equals: parseFloat(query) || 0 } },
          {
            date: isNaN(Date.parse(query))
              ? undefined
              : { equals: new Date(query) },
          },
          { status: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        customer: true,
      },
      orderBy: {
        date: 'desc',
      },
      take: ITEMS_PER_PAGE, // Adjust this according to your needs
      skip: offset,
    });

    const flattenedInvoices = invoicesWithCustomers.map((invoice) => ({
      id: invoice.id,
      amount: invoice.amount,
      date: invoice.date.toISOString(),
      status: invoice.status,
      name: invoice.customer.name,
      email: invoice.customer.email,
      image_url: invoice.customer.image_url,
    }));

    console.log(flattenedInvoices);
    return flattenedInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  noStore();
  try {
    const count = await prisma.invoice.aggregate({
      _count: {
        _all: true,
      },
      where: {
        OR: [
          { customer: { name: { contains: query, mode: 'insensitive' } } },
          { customer: { email: { contains: query, mode: 'insensitive' } } },
          { amount: { equals: parseFloat(query) || 0 } },
          {
            date: isNaN(Date.parse(query))
              ? undefined
              : { equals: new Date(query) },
          },
          { status: { contains: query, mode: 'insensitive' } },
        ],
      },
    });

    const totalPages = Math.ceil(count._count._all / ITEMS_PER_PAGE);

    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  noStore();
  try {
    const invoice = await prisma.invoice.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        customer_id: true,
        amount: true,
        status: true,
      },
    });

    if (invoice) {
      // Convert amount from cents to dollars
      invoice.amount = invoice.amount / 100;
    }

    return invoice;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  noStore();
  try {
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  noStore();
  try {
    const data = await sql<CustomersTableType>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}

export async function getUser(email: string) {
  noStore();
  try {
    const user = await sql`SELECT * FROM users WHERE email=${email}`;
    return user.rows[0] as User;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}
