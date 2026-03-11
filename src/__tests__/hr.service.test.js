'use strict';

jest.mock('../config/db', () => ({
    onboardingCandidate: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
}));

const prisma = require('../config/db');
const { stageCandidate } = require('../services/hr.service');

const VALID_EMAIL = 'test@gmail.com';
const VALID_PHONE = '+919876543210';
const VALID_FIRST = 'Test';
const VALID_LAST = 'User';

const futureExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h from now
const pastExpiry = new Date(Date.now() - 1000); // already expired

beforeEach(() => {
    jest.clearAllMocks();
});

describe('stageCandidate', () => {

    it('creates a new candidate and returns token when no existing record', async () => {
        prisma.onboardingCandidate.findFirst.mockResolvedValue(null);
        prisma.onboardingCandidate.create.mockResolvedValue({
            id: 'cand-001',
            inviteToken: 'mock-token-abc',
        });

        const result = await stageCandidate(VALID_EMAIL, VALID_FIRST, VALID_LAST, VALID_PHONE);

        expect(prisma.onboardingCandidate.create).toHaveBeenCalled();
        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('candidateId', 'cand-001');
    });

    it('throws CANDIDATE_ALREADY_ONBOARDED for ACTIVE status', async () => {
        prisma.onboardingCandidate.findFirst.mockResolvedValue({
            id: 'cand-001',
            onboardingStatus: 'ACTIVE',
            tokenExpiry: futureExpiry,
        });

        await expect(
            stageCandidate(VALID_EMAIL, VALID_FIRST, VALID_LAST, VALID_PHONE)
        ).rejects.toMatchObject({ code: 'CANDIDATE_ALREADY_ONBOARDED' });

        expect(prisma.onboardingCandidate.create).not.toHaveBeenCalled();
    });

    it('throws CANDIDATE_ALREADY_ONBOARDED for all terminal statuses', async () => {
        const terminalStatuses = [
            'DOCS_UPLOADED', 'OFFER_ROLLED', 'OFFER_ACCEPTED',
            'RESIGNATION_VERIFIED', 'BGV_CLEARED', 'BANK_DETAILS_SUBMITTED',
            'ACTIVE', 'REJECTED',
        ];

        for (const status of terminalStatuses) {
            prisma.onboardingCandidate.findFirst.mockResolvedValue({
                id: 'cand-001',
                onboardingStatus: status,
                tokenExpiry: pastExpiry,
            });

            await expect(
                stageCandidate(VALID_EMAIL, VALID_FIRST, VALID_LAST, VALID_PHONE)
            ).rejects.toMatchObject({ code: 'CANDIDATE_ALREADY_ONBOARDED' });
        }
    });

    it('throws ACTIVE_INVITE_EXISTS when invite is still valid (not expired)', async () => {
        prisma.onboardingCandidate.findFirst.mockResolvedValue({
            id: 'cand-001',
            onboardingStatus: 'INVITED',
            tokenExpiry: futureExpiry,
        });

        await expect(
            stageCandidate(VALID_EMAIL, VALID_FIRST, VALID_LAST, VALID_PHONE)
        ).rejects.toMatchObject({ code: 'ACTIVE_INVITE_EXISTS' });

        expect(prisma.onboardingCandidate.update).not.toHaveBeenCalled();
    });

    it('refreshes token when existing invite is expired', async () => {
        prisma.onboardingCandidate.findFirst.mockResolvedValue({
            id: 'cand-001',
            onboardingStatus: 'INVITED',
            tokenExpiry: pastExpiry,
        });
        prisma.onboardingCandidate.update.mockResolvedValue({ id: 'cand-001' });

        const result = await stageCandidate(VALID_EMAIL, VALID_FIRST, VALID_LAST, VALID_PHONE);

        expect(prisma.onboardingCandidate.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'cand-001' },
                data: expect.objectContaining({ inviteToken: expect.any(String) }),
            })
        );
        expect(result).toHaveProperty('token');
        expect(result.candidateId).toBe('cand-001');
    });

    it('returned token is a 64-char hex string (32 random bytes)', async () => {
        prisma.onboardingCandidate.findFirst.mockResolvedValue(null);
        prisma.onboardingCandidate.create.mockImplementation(({ data }) =>
            Promise.resolve({ id: 'cand-new', inviteToken: data.inviteToken })
        );

        const result = await stageCandidate(VALID_EMAIL, VALID_FIRST, VALID_LAST, VALID_PHONE);

        expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    });
});
