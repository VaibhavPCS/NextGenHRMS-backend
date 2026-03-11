// prisma/seed.js
// Run with: npx prisma db seed
// Idempotent — safe to run multiple times (uses upsert throughout)

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────
// 1. PERMISSION DEFINITIONS
//    key    → used in code:  hasPermission("LEAVE_APPROVE")
//    label  → shown in UI:   "Approve Leaves"
//    module → groups in UI:  "LEAVE"
// ─────────────────────────────────────────────────────────────
const PERMISSIONS = [
  // Dashboard
  { key: 'DASHBOARD_VIEW',       label: 'View Dashboard',            module: 'DASHBOARD'    },

  // Employees
  { key: 'EMPLOYEE_VIEW',        label: 'View Employees',            module: 'EMPLOYEES'    },
  { key: 'EMPLOYEE_CREATE',      label: 'Create Employee',           module: 'EMPLOYEES'    },
  { key: 'EMPLOYEE_EDIT',        label: 'Edit Employee',             module: 'EMPLOYEES'    },
  { key: 'EMPLOYEE_DELETE',      label: 'Delete Employee',           module: 'EMPLOYEES'    },

  // Leaves
  { key: 'LEAVE_VIEW',           label: 'View Leaves',               module: 'LEAVES'       },
  { key: 'LEAVE_CREATE',         label: 'Apply for Leave',           module: 'LEAVES'       },
  { key: 'LEAVE_APPROVE',        label: 'Approve / Reject Leaves',   module: 'LEAVES'       },

  // Payroll
  { key: 'PAYROLL_VIEW',         label: 'View Payroll',              module: 'PAYROLL'      },
  { key: 'PAYROLL_EDIT',         label: 'Edit Payroll',              module: 'PAYROLL'      },
  { key: 'PAYROLL_APPROVE',      label: 'Approve Payroll',           module: 'PAYROLL'      },

  // Recruitment
  { key: 'RECRUITMENT_VIEW',     label: 'View Recruitment Pipeline', module: 'RECRUITMENT'  },
  { key: 'RECRUITMENT_INVITE',   label: 'Send Candidate Invites',    module: 'RECRUITMENT'  },
  { key: 'CANDIDATE_MANAGE',     label: 'Manage Candidate Details',  module: 'RECRUITMENT'  },

  // Roles & Permissions
  { key: 'ROLE_VIEW',            label: 'View Roles',                module: 'ROLES'        },
  { key: 'ROLE_CREATE',          label: 'Create Custom Roles',       module: 'ROLES'        },
  { key: 'ROLE_EDIT',            label: 'Edit Roles',                module: 'ROLES'        },
  { key: 'ROLE_DELETE',          label: 'Delete Custom Roles',       module: 'ROLES'        },

  // Reports
  { key: 'REPORT_VIEW',          label: 'View Reports',              module: 'REPORTS'      },
  { key: 'REPORT_EXPORT',        label: 'Export Reports',            module: 'REPORTS'      },
];

// ─────────────────────────────────────────────────────────────
// 2. SYSTEM ROLE DEFINITIONS
//    isSystem: true → cannot be deleted or renamed from the UI
// ─────────────────────────────────────────────────────────────
const SYSTEM_ROLES = [
  {
    name: 'Super Admin',
    isSystem: true,
    // Gets every single permission
    permissions: PERMISSIONS.map(p => p.key),
  },
  {
    name: 'HR Admin',
    isSystem: true,
    permissions: [
      'DASHBOARD_VIEW',
      'EMPLOYEE_VIEW', 'EMPLOYEE_CREATE', 'EMPLOYEE_EDIT',
      'LEAVE_VIEW', 'LEAVE_APPROVE',
      'PAYROLL_VIEW', 'PAYROLL_EDIT', 'PAYROLL_APPROVE',
      'RECRUITMENT_VIEW', 'RECRUITMENT_INVITE', 'CANDIDATE_MANAGE',
      'ROLE_VIEW', 'ROLE_CREATE', 'ROLE_EDIT',  // no ROLE_DELETE
      'REPORT_VIEW', 'REPORT_EXPORT',
    ],
  },
  {
    name: 'HR',
    isSystem: true,
    permissions: [
      'DASHBOARD_VIEW',
      'EMPLOYEE_VIEW', 'EMPLOYEE_CREATE',
      'LEAVE_VIEW', 'LEAVE_APPROVE',
      'RECRUITMENT_VIEW', 'RECRUITMENT_INVITE', 'CANDIDATE_MANAGE',
      'REPORT_VIEW',
    ],
  },
  {
    name: 'Manager',
    isSystem: true,
    permissions: [
      'DASHBOARD_VIEW',
      'EMPLOYEE_VIEW',
      'LEAVE_VIEW', 'LEAVE_APPROVE',
      'REPORT_VIEW',
    ],
  },
  {
    name: 'Employee',
    isSystem: true,
    permissions: [
      'DASHBOARD_VIEW',
      'LEAVE_VIEW', 'LEAVE_CREATE',
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// SEED RUNNER
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding permissions...');

  // Step 1: Upsert all permissions (safe to re-run)
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { label: perm.label, module: perm.module },
      create: { key: perm.key, label: perm.label, module: perm.module },
    });
  }

  console.log(`  ✓ ${PERMISSIONS.length} permissions upserted`);

  // Step 2: Fetch all permissions so we have their DB ids
  const allPerms = await prisma.permission.findMany();
  const permByKey = Object.fromEntries(allPerms.map(p => [p.key, p]));

  console.log('Seeding system roles...');

  // Step 3: Upsert each system role with the correct permissionIds
  for (const roleDef of SYSTEM_ROLES) {
    const permissionIds = roleDef.permissions.map(key => {
      if (!permByKey[key]) throw new Error(`Unknown permission key: "${key}"`);
      return permByKey[key].id;
    });

    await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { isSystem: roleDef.isSystem, permissionIds },
      create: { name: roleDef.name, isSystem: roleDef.isSystem, permissionIds },
    });

    console.log(`  ✓ Role "${roleDef.name}" — ${permissionIds.length} permissions`);
  }

  console.log('\nSeed complete.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
