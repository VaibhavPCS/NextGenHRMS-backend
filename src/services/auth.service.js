const supertokens = require('supertokens-node');
const prisma = require('../config/db');
const logger = require('../utils/logger');

const linkUserToEmployee = async (supertokensId) => {

    // Step 1: Get verified phone number directly from SuperTokens
    // Never trust the frontend to send this — we extract it from the cryptographic session
    let userInfo;
    try {
        userInfo = await supertokens.getUser(supertokensId);
    } catch (error) {
        throw new Error("Error fetching user from SuperTokens: " + error.message);
    }

    // Separate null check from the fetch error — cleaner error messages
    if (!userInfo) {
        const err = new Error("User not found in SuperTokens.");
        err.code = 'SUPERTOKENS_USER_NOT_FOUND';
        throw err;
    }

    // Guard: phone number must exist on the SuperTokens user object
    if (!userInfo.phoneNumbers || userInfo.phoneNumbers.length === 0) {
        const err = new Error("No phone number associated with this session.");
        err.code = 'NO_PHONE_ON_SESSION';
        throw err;
    }

    const phoneNumber = userInfo.phoneNumbers[0];

    // Step 2: Find the matching employee in our database by verified phone number
    let employee;
    try {
        employee = await prisma.employee.findUnique({
            where: { phoneNumber },
            select: {
                id: true,
                supertokensId: true,  // needed for idempotency check below
                isActive: true,
                phoneNumber: true,
                firstName: true,
                lastName: true,
                designation: true,
                companyEmail: true,
                roleId: true,
            }
        });
    } catch (error) {
        throw new Error("Error fetching employee from database: " + error.message);
    }

    // Edge case: phone number is in SuperTokens but HR never onboarded this person
    if (!employee) {
        try {
            await supertokens.deleteUser(supertokensId);
        } catch (deleteError) {
            // Log but don't let a failed cleanup block the 403 response
            logger.error({
                event: 'DELETE_UNRECOGNISED_USER_FAILED',
                err: deleteError,
            }, 'Failed to delete unrecognised SuperTokens user during NOT_ONBOARDED cleanup');
        }
        const err = new Error("You are not a registered employee.");
        err.code = 'NOT_ONBOARDED';
        throw err;
    }

    // Termination check — fired/resigned employees exist in the table but must be blocked
    if (!employee.isActive) {
        try {
            await supertokens.deleteUser(supertokensId);
        } catch (deleteError) {
            logger.error({
                event: 'DELETE_REVOKED_USER_FAILED',
                err: deleteError,
            }, "Failed to delete revoked employee's SuperTokens user during ACCESS_REVOKED cleanup");
        }
        const err = new Error("Your corporate access has been revoked. Please contact HR.");
        err.code = 'ACCESS_REVOKED';
        throw err;
    }

    // Idempotency: already linked on a previous login — skip the DB write
    if (employee.supertokensId === supertokensId) {
        logger.info({
            event: 'SESSION_LINK_SKIPPED',
            employeeId: employee.id,
        }, 'Session already linked — idempotency check passed, skipping DB write');
        return employee;
    }

    // Step 3: Link the SuperTokens ID to the employee record
    let updatedEmployee;
    try {
        updatedEmployee = await prisma.employee.update({
            where: { id: employee.id },
            data: { supertokensId },
            select: {
                id: true,
                phoneNumber: true,
                firstName: true,
                lastName: true,
                designation: true,
                companyEmail: true,
                roleId: true,
            }
        });
    } catch (error) {
        throw new Error("Failed to link session to employee record: " + error.message);
    }

    return updatedEmployee;
};

module.exports = { linkUserToEmployee };
