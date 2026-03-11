const prisma = require('../config/db');

const getEmployeeProfile = async (supertokensId) => {

    // Single query — fetches employee + role + all permission objects (no N+1)
    const employee = await prisma.employee.findUnique({
        where: { supertokensId },
        include: {
            role: {
                include: { permissions: true }
            }
        }
    });

    if (!employee) {
        const err = new Error("Employee not found.");
        err.code = 'EMPLOYEE_NOT_FOUND';
        throw err;
    }

    if (!employee.isActive) {
        const err = new Error("Your corporate access has been revoked. Please contact HR.");
        err.code = 'ACCESS_REVOKED';
        throw err;
    }

    // Resolve effective permissions:
    // Start with everything the role grants, then apply per-employee overrides
    // p.key — the string used in code checks e.g. "LEAVE_APPROVE"
    const rolePermissionKeys = employee.role.permissions.map(p => p.key);
    const effectivePermissions = new Set(rolePermissionKeys);

    employee.grantedPermissions.forEach(p => effectivePermissions.add(p));
    employee.revokedPermissions.forEach(p => effectivePermissions.delete(p));

    return {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        designation: employee.designation,
        companyEmail: employee.companyEmail,
        role: {
            name: employee.role.name,
            isSystem: employee.role.isSystem,
        },
        permissions: Array.from(effectivePermissions),
    };
};

module.exports = { getEmployeeProfile };
