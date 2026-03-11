'use strict';

jest.mock('../config/db', () => ({
    employee: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
}));

jest.mock('supertokens-node', () => ({
    getUser: jest.fn(),
    deleteUser: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const supertokens = require('supertokens-node');
const prisma = require('../config/db');
const { linkUserToEmployee } = require('../services/auth.service');

const MOCK_ST_ID = 'st-user-abc123';
const MOCK_PHONE = '+917651908319';

const mockEmployee = (overrides = {}) => ({
    id: 'emp-001',
    supertokensId: null,
    isActive: true,
    phoneNumber: MOCK_PHONE,
    firstName: 'Vaibhav',
    lastName: 'Sahay',
    designation: 'Engineer',
    companyEmail: 'v@company.com',
    roleId: 'role-001',
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('linkUserToEmployee', () => {

    it('links successfully on first login (SESSION_LINKED)', async () => {
        supertokens.getUser.mockResolvedValue({ phoneNumbers: [MOCK_PHONE] });
        prisma.employee.findUnique.mockResolvedValue(mockEmployee({ supertokensId: null }));
        prisma.employee.update.mockResolvedValue(mockEmployee({ supertokensId: MOCK_ST_ID }));

        const result = await linkUserToEmployee(MOCK_ST_ID);

        expect(prisma.employee.update).toHaveBeenCalledWith(expect.objectContaining({
            data: { supertokensId: MOCK_ST_ID },
        }));
        expect(result.supertokensId).toBe(MOCK_ST_ID);
    });

    it('skips DB write when already linked (SESSION_LINK_SKIPPED idempotency)', async () => {
        supertokens.getUser.mockResolvedValue({ phoneNumbers: [MOCK_PHONE] });
        prisma.employee.findUnique.mockResolvedValue(mockEmployee({ supertokensId: MOCK_ST_ID }));

        const result = await linkUserToEmployee(MOCK_ST_ID);

        expect(prisma.employee.update).not.toHaveBeenCalled();
        expect(result.supertokensId).toBe(MOCK_ST_ID);
    });

    it('throws SUPERTOKENS_USER_NOT_FOUND when getUser returns null', async () => {
        supertokens.getUser.mockResolvedValue(null);

        await expect(linkUserToEmployee(MOCK_ST_ID)).rejects.toMatchObject({
            code: 'SUPERTOKENS_USER_NOT_FOUND',
        });
    });

    it('throws NO_PHONE_ON_SESSION when phoneNumbers is empty', async () => {
        supertokens.getUser.mockResolvedValue({ phoneNumbers: [] });

        await expect(linkUserToEmployee(MOCK_ST_ID)).rejects.toMatchObject({
            code: 'NO_PHONE_ON_SESSION',
        });
    });

    it('throws NOT_ONBOARDED and deletes ST user when phone not in Employee table', async () => {
        supertokens.getUser.mockResolvedValue({ phoneNumbers: [MOCK_PHONE] });
        prisma.employee.findUnique.mockResolvedValue(null);
        supertokens.deleteUser.mockResolvedValue();

        await expect(linkUserToEmployee(MOCK_ST_ID)).rejects.toMatchObject({
            code: 'NOT_ONBOARDED',
        });
        expect(supertokens.deleteUser).toHaveBeenCalledWith(MOCK_ST_ID);
    });

    it('throws ACCESS_REVOKED and deletes ST user when employee isActive is false', async () => {
        supertokens.getUser.mockResolvedValue({ phoneNumbers: [MOCK_PHONE] });
        prisma.employee.findUnique.mockResolvedValue(mockEmployee({ isActive: false }));
        supertokens.deleteUser.mockResolvedValue();

        await expect(linkUserToEmployee(MOCK_ST_ID)).rejects.toMatchObject({
            code: 'ACCESS_REVOKED',
        });
        expect(supertokens.deleteUser).toHaveBeenCalledWith(MOCK_ST_ID);
    });

    it('still throws NOT_ONBOARDED even if deleteUser fails (cleanup failure is non-fatal)', async () => {
        supertokens.getUser.mockResolvedValue({ phoneNumbers: [MOCK_PHONE] });
        prisma.employee.findUnique.mockResolvedValue(null);
        supertokens.deleteUser.mockRejectedValue(new Error('ST down'));

        await expect(linkUserToEmployee(MOCK_ST_ID)).rejects.toMatchObject({
            code: 'NOT_ONBOARDED',
        });
    });
});
