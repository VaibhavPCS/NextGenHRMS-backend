'use strict';

jest.mock('../config/db', () => ({
    employee: {
        findUnique: jest.fn(),
    },
}));

const prisma = require('../config/db');
const { getEmployeeProfile } = require('../services/employee.service');

const MOCK_ST_ID = 'st-user-abc123';

const mockDbEmployee = (overrides = {}) => ({
    id: 'emp-001',
    firstName: 'Vaibhav',
    lastName: 'Sahay',
    designation: 'Engineer',
    companyEmail: 'v@company.com',
    isActive: true,
    grantedPermissions: [],
    revokedPermissions: [],
    role: {
        name: 'Employee',
        isSystem: true,
        permissions: [
            { key: 'DASHBOARD_VIEW' },
            { key: 'LEAVE_VIEW' },
            { key: 'LEAVE_CREATE' },
        ],
    },
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('getEmployeeProfile', () => {

    it('returns profile with role permissions on success', async () => {
        prisma.employee.findUnique.mockResolvedValue(mockDbEmployee());

        const result = await getEmployeeProfile(MOCK_ST_ID);

        expect(result.firstName).toBe('Vaibhav');
        expect(result.role.name).toBe('Employee');
        expect(result.permissions).toEqual(
            expect.arrayContaining(['DASHBOARD_VIEW', 'LEAVE_VIEW', 'LEAVE_CREATE'])
        );
        expect(result.permissions).toHaveLength(3);
    });

    it('throws EMPLOYEE_NOT_FOUND when no employee matches supertokensId', async () => {
        prisma.employee.findUnique.mockResolvedValue(null);

        await expect(getEmployeeProfile(MOCK_ST_ID)).rejects.toMatchObject({
            code: 'EMPLOYEE_NOT_FOUND',
        });
    });

    it('throws ACCESS_REVOKED when employee isActive is false', async () => {
        prisma.employee.findUnique.mockResolvedValue(mockDbEmployee({ isActive: false }));

        await expect(getEmployeeProfile(MOCK_ST_ID)).rejects.toMatchObject({
            code: 'ACCESS_REVOKED',
        });
    });

    it('adds grantedPermissions on top of role permissions', async () => {
        prisma.employee.findUnique.mockResolvedValue(
            mockDbEmployee({ grantedPermissions: ['PAYROLL_VIEW'] })
        );

        const result = await getEmployeeProfile(MOCK_ST_ID);

        expect(result.permissions).toContain('PAYROLL_VIEW');
        expect(result.permissions).toHaveLength(4);
    });

    it('removes revokedPermissions from role permissions', async () => {
        prisma.employee.findUnique.mockResolvedValue(
            mockDbEmployee({ revokedPermissions: ['LEAVE_CREATE'] })
        );

        const result = await getEmployeeProfile(MOCK_ST_ID);

        expect(result.permissions).not.toContain('LEAVE_CREATE');
        expect(result.permissions).toHaveLength(2);
    });

    it('grant then revoke the same key results in no permission (revoke wins)', async () => {
        prisma.employee.findUnique.mockResolvedValue(
            mockDbEmployee({
                grantedPermissions: ['PAYROLL_VIEW'],
                revokedPermissions: ['PAYROLL_VIEW'],
            })
        );

        const result = await getEmployeeProfile(MOCK_ST_ID);

        expect(result.permissions).not.toContain('PAYROLL_VIEW');
    });

    it('does not expose internal fields (supertokensId, roleId, isActive)', async () => {
        prisma.employee.findUnique.mockResolvedValue(mockDbEmployee());

        const result = await getEmployeeProfile(MOCK_ST_ID);

        expect(result).not.toHaveProperty('supertokensId');
        expect(result).not.toHaveProperty('roleId');
        expect(result).not.toHaveProperty('isActive');
        expect(result).not.toHaveProperty('grantedPermissions');
        expect(result).not.toHaveProperty('revokedPermissions');
    });
});
