// seeders/seedAdmin.js
//
// Creates:
//   1. Admin user
//   2. Day-shift employee  (hourly)
//   3. Night-shift employee (monthly) — needed to test CSV night-shift import (req #4)
//   4. A few more employees across departments for performance/payroll charts

import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import dotenv from 'dotenv';

dotenv.config();

const EMPLOYEES = [
  // ── Admin ──────────────────────────────────────────────────────────────────
  {
    email:          'admin@example.com',
    employeeNumber: 'ADMIN001',
    firstName:      'Admin',
    lastName:       'User',
    department:     'Manager',
    role:           'admin',
    joiningDate:    new Date(),
    shift:          { start: '09:00', end: '18:00' },
    salaryType:     'monthly',
    hourlyRate:     500,
    monthlySalary:  150000,
    status:         'Active',
    password:       'Admin@123456'
  },

  // ── Day-shift employees (hourly) ───────────────────────────────────────────
  {
    email:          'john.doe@example.com',
    employeeNumber: 'EMP001',
    firstName:      'John',
    lastName:       'Doe',
    department:     'IT',
    role:           'employee',
    joiningDate:    new Date(Date.now() - 200 * 86_400_000),
    shift:          { start: '09:00', end: '18:00' },
    salaryType:     'hourly',
    hourlyRate:     300,
    monthlySalary:  null,
    status:         'Active',
    password:       'Employee@123456'
  },
  {
    email:          'sara.khan@example.com',
    employeeNumber: 'EMP002',
    firstName:      'Sara',
    lastName:       'Khan',
    department:     'HR',
    role:           'employee',
    joiningDate:    new Date(Date.now() - 300 * 86_400_000),
    shift:          { start: '09:00', end: '18:00' },
    salaryType:     'monthly',
    hourlyRate:     250,
    monthlySalary:  65000,
    status:         'Active',
    password:       'Employee@123456'
  },
  {
    email:          'ali.raza@example.com',
    employeeNumber: 'EMP003',
    firstName:      'Ali',
    lastName:       'Raza',
    department:     'Finance',
    role:           'employee',
    joiningDate:    new Date(Date.now() - 120 * 86_400_000),
    shift:          { start: '09:00', end: '18:00' },
    salaryType:     'hourly',
    hourlyRate:     280,
    monthlySalary:  null,
    status:         'Active',
    password:       'Employee@123456'
  },
  {
    email:          'fatima.malik@example.com',
    employeeNumber: 'EMP004',
    firstName:      'Fatima',
    lastName:       'Malik',
    department:     'Marketing',
    role:           'employee',
    joiningDate:    new Date(Date.now() - 400 * 86_400_000),
    shift:          { start: '09:00', end: '18:00' },
    salaryType:     'monthly',
    hourlyRate:     270,
    monthlySalary:  70000,
    status:         'Active',
    password:       'Employee@123456'
  },
  {
    email:          'usman.tariq@example.com',
    employeeNumber: 'EMP005',
    firstName:      'Usman',
    lastName:       'Tariq',
    department:     'Customer Support',
    role:           'employee',
    joiningDate:    new Date(Date.now() - 90 * 86_400_000),
    shift:          { start: '09:00', end: '18:00' },
    salaryType:     'hourly',
    hourlyRate:     220,
    monthlySalary:  null,
    status:         'Active',
    password:       'Employee@123456'
  },

  // ── Night-shift employee (monthly) ────────────────────────────────────────
  // Used specifically to test CSV import with the 14-hour window rule (req #4).
  // shift.end < shift.start  →  isNightShift = true (set in AttendanceLog pre-save)
  {
    email:          'night.watch@example.com',
    employeeNumber: 'EMP006',
    firstName:      'Bilal',
    lastName:       'Siddiqui',
    department:     'IT',
    role:           'employee',
    joiningDate:    new Date(Date.now() - 180 * 86_400_000),
    shift:          { start: '22:00', end: '06:00' },   // crosses midnight
    salaryType:     'monthly',
    hourlyRate:     350,
    monthlySalary:  90000,
    status:         'Active',
    password:       'Employee@123456'
  }
];

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    for (const data of EMPLOYEES) {
      const existing = await Employee.findOne({ email: data.email });

      if (existing) {
        console.log(`  → already exists: ${data.email}`);
        continue;
      }

      const emp = new Employee(data);
      await emp.save();

      console.log(`✓ Created [${emp.role.padEnd(8)}] ${emp.firstName} ${emp.lastName}`);
      console.log(`    email    : ${emp.email}`);
      console.log(`    empNo    : ${emp.employeeNumber}`);
      console.log(`    shift    : ${emp.shift.start} – ${emp.shift.end}`);
      console.log(`    salary   : ${emp.salaryType === 'monthly'
        ? `monthly = ${emp.monthlySalary}`
        : `hourly  = ${emp.hourlyRate}/hr`}`);
    }

    console.log('\n✓ seedAdmin complete');
    process.exit(0);
  } catch (err) {
    console.error('✗ seedAdmin error:', err.message);
    process.exit(1);
  }
}

seedAdmin();