import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { employeesTable, accountsTable } from '../db/schema';
import { type CreateEmployeeInput, type CreateAccountInput } from '../schema';
import { getEmployees } from '../handlers/get_employees';

describe('getEmployees', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no employees exist', async () => {
    const result = await getEmployees();
    expect(result).toEqual([]);
  });

  it('should return all employees', async () => {
    // Create payroll accounts first (required for employees)
    const accountInput1: CreateAccountInput = {
      code: 'PAYROLL-USD',
      name: 'Payroll USD',
      account_type: 'Expense',
      currency: 'USD',
      is_bank: false,
      is_capital: false,
      is_payroll_source: true,
      is_intercompany: false,
      parent_id: null,
      is_active: true
    };

    const accountInput2: CreateAccountInput = {
      code: 'PAYROLL-PKR',
      name: 'Payroll PKR',
      account_type: 'Expense',
      currency: 'PKR',
      is_bank: false,
      is_capital: false,
      is_payroll_source: true,
      is_intercompany: false,
      parent_id: null,
      is_active: true
    };

    const accounts = await db.insert(accountsTable)
      .values([accountInput1, accountInput2])
      .returning()
      .execute();

    // Create test employees
    const employeeInput1: CreateEmployeeInput = {
      name: 'John Doe',
      email: 'john.doe@company.com',
      payroll_currency: 'USD',
      payroll_account_id: accounts[0].id
    };

    const employeeInput2: CreateEmployeeInput = {
      name: 'Jane Smith',
      email: null,
      payroll_currency: 'PKR',
      payroll_account_id: accounts[1].id
    };

    const employees = await db.insert(employeesTable)
      .values([employeeInput1, employeeInput2])
      .returning()
      .execute();

    const result = await getEmployees();

    expect(result).toHaveLength(2);
    
    // Verify first employee
    const employee1 = result.find(e => e.name === 'John Doe');
    expect(employee1).toBeDefined();
    expect(employee1!.name).toEqual('John Doe');
    expect(employee1!.email).toEqual('john.doe@company.com');
    expect(employee1!.payroll_currency).toEqual('USD');
    expect(employee1!.payroll_account_id).toEqual(accounts[0].id);
    expect(employee1!.id).toBeDefined();
    expect(employee1!.created_at).toBeInstanceOf(Date);
    expect(employee1!.updated_at).toBeInstanceOf(Date);

    // Verify second employee
    const employee2 = result.find(e => e.name === 'Jane Smith');
    expect(employee2).toBeDefined();
    expect(employee2!.name).toEqual('Jane Smith');
    expect(employee2!.email).toBeNull();
    expect(employee2!.payroll_currency).toEqual('PKR');
    expect(employee2!.payroll_account_id).toEqual(accounts[1].id);
    expect(employee2!.id).toBeDefined();
    expect(employee2!.created_at).toBeInstanceOf(Date);
    expect(employee2!.updated_at).toBeInstanceOf(Date);
  });

  it('should return employees in consistent order', async () => {
    // Create payroll account
    const accountInput: CreateAccountInput = {
      code: 'PAYROLL-TEST',
      name: 'Test Payroll',
      account_type: 'Expense',
      currency: 'USD',
      is_bank: false,
      is_capital: false,
      is_payroll_source: true,
      is_intercompany: false,
      parent_id: null,
      is_active: true
    };

    const accounts = await db.insert(accountsTable)
      .values([accountInput])
      .returning()
      .execute();

    // Create multiple employees with different names
    const employeeInputs: CreateEmployeeInput[] = [
      {
        name: 'Charlie Brown',
        email: 'charlie@company.com',
        payroll_currency: 'USD',
        payroll_account_id: accounts[0].id
      },
      {
        name: 'Alice Cooper',
        email: 'alice@company.com',
        payroll_currency: 'USD',
        payroll_account_id: accounts[0].id
      },
      {
        name: 'Bob Wilson',
        email: 'bob@company.com',
        payroll_currency: 'USD',
        payroll_account_id: accounts[0].id
      }
    ];

    await db.insert(employeesTable)
      .values(employeeInputs)
      .execute();

    // Call getEmployees multiple times to ensure consistent ordering
    const result1 = await getEmployees();
    const result2 = await getEmployees();

    expect(result1).toHaveLength(3);
    expect(result2).toHaveLength(3);

    // Results should be in the same order (by ID)
    expect(result1.map(e => e.id)).toEqual(result2.map(e => e.id));
    expect(result1.map(e => e.name)).toEqual(result2.map(e => e.name));
  });

  it('should handle employees with different currencies', async () => {
    // Create payroll accounts for both currencies
    const accountInputs: CreateAccountInput[] = [
      {
        code: 'PAYROLL-USD-2',
        name: 'USD Payroll 2',
        account_type: 'Expense',
        currency: 'USD',
        is_bank: false,
        is_capital: false,
        is_payroll_source: true,
        is_intercompany: false,
        parent_id: null,
        is_active: true
      },
      {
        code: 'PAYROLL-PKR-2',
        name: 'PKR Payroll 2',
        account_type: 'Expense',
        currency: 'PKR',
        is_bank: false,
        is_capital: false,
        is_payroll_source: true,
        is_intercompany: false,
        parent_id: null,
        is_active: true
      }
    ];

    const accounts = await db.insert(accountsTable)
      .values(accountInputs)
      .returning()
      .execute();

    // Create employees with different currencies
    const employeeInputs: CreateEmployeeInput[] = [
      {
        name: 'USD Employee',
        email: 'usd@company.com',
        payroll_currency: 'USD',
        payroll_account_id: accounts[0].id
      },
      {
        name: 'PKR Employee',
        email: 'pkr@company.com',
        payroll_currency: 'PKR',
        payroll_account_id: accounts[1].id
      }
    ];

    await db.insert(employeesTable)
      .values(employeeInputs)
      .execute();

    const result = await getEmployees();

    expect(result).toHaveLength(2);

    const usdEmployee = result.find(e => e.name === 'USD Employee');
    const pkrEmployee = result.find(e => e.name === 'PKR Employee');

    expect(usdEmployee).toBeDefined();
    expect(usdEmployee!.payroll_currency).toEqual('USD');
    expect(usdEmployee!.payroll_account_id).toEqual(accounts[0].id);

    expect(pkrEmployee).toBeDefined();
    expect(pkrEmployee!.payroll_currency).toEqual('PKR');
    expect(pkrEmployee!.payroll_account_id).toEqual(accounts[1].id);
  });

  it('should handle employees with and without email addresses', async () => {
    // Create payroll account
    const accountInput: CreateAccountInput = {
      code: 'PAYROLL-MIXED',
      name: 'Mixed Payroll',
      account_type: 'Expense',
      currency: 'USD',
      is_bank: false,
      is_capital: false,
      is_payroll_source: true,
      is_intercompany: false,
      parent_id: null,
      is_active: true
    };

    const accounts = await db.insert(accountsTable)
      .values([accountInput])
      .returning()
      .execute();

    // Create employees - one with email, one without
    const employeeInputs: CreateEmployeeInput[] = [
      {
        name: 'Employee With Email',
        email: 'with.email@company.com',
        payroll_currency: 'USD',
        payroll_account_id: accounts[0].id
      },
      {
        name: 'Employee Without Email',
        email: null,
        payroll_currency: 'USD',
        payroll_account_id: accounts[0].id
      }
    ];

    await db.insert(employeesTable)
      .values(employeeInputs)
      .execute();

    const result = await getEmployees();

    expect(result).toHaveLength(2);

    const withEmail = result.find(e => e.name === 'Employee With Email');
    const withoutEmail = result.find(e => e.name === 'Employee Without Email');

    expect(withEmail).toBeDefined();
    expect(withEmail!.email).toEqual('with.email@company.com');

    expect(withoutEmail).toBeDefined();
    expect(withoutEmail!.email).toBeNull();
  });
});