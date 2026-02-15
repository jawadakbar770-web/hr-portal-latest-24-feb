const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const Employee = require('../models/Employee');

async function seedAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await Employee.findOne({ 
      email: 'admin@example.com',
      department: 'Manager'
    });

    if (existingAdmin) {
      console.log('Admin already exists');
      process.exit(0);
    }

    // Create admin user
    const admin = new Employee({
      email: 'admin@example.com',
      employeeNumber: 'ADMIN001',
      firstName: 'Admin',
      lastName: 'User',
      department: 'Manager',
      joiningDate: new Date(),
      shift: {
        start: '09:00',
        end: '18:00'
      },
      hourlyRate: 500,
      status: 'Active',
      password: 'Admin@123456', // Will be hashed by pre-save hook
      bank: {
        bankName: 'HBL',
        accountName: 'Admin Account',
        accountNumber: '1234567890'
      }
    });

    await admin.save();
    console.log('Admin user created successfully');
    console.log('Email: admin@example.com');
    console.log('Password: Admin@123456');

    // Create a demo employee
    const employee = new Employee({
      email: 'employee@example.com',
      employeeNumber: 'EMP001',
      firstName: 'John',
      lastName: 'Doe',
      department: 'IT',
      joiningDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), // 120 days ago
      shift: {
        start: '09:00',
        end: '18:00'
      },
      hourlyRate: 200,
      status: 'Active',
      password: 'Employee@123456',
      bank: {
        bankName: 'UBL',
        accountName: 'John Doe',
        accountNumber: '9876543210'
      }
    });

    await employee.save();
    console.log('Demo employee created successfully');
    console.log('Email: employee@example.com');
    console.log('Password: Employee@123456');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
}

seedAdmin();