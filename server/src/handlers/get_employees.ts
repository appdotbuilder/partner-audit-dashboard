import { db } from '../db';
import { employeesTable } from '../db/schema';
import { type Employee } from '../schema';

export const getEmployees = async (): Promise<Employee[]> => {
  try {
    const results = await db.select()
      .from(employeesTable)
      .execute();

    // Convert the results to proper types (no numeric conversions needed for employees table)
    return results.map(employee => ({
      ...employee,
      created_at: employee.created_at,
      updated_at: employee.updated_at
    }));
  } catch (error) {
    console.error('Failed to fetch employees:', error);
    throw error;
  }
};