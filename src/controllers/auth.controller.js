const { linkUserToEmployee } = require('../services/auth.service');

const linkUserToEmployeeController = async (req, res) => {
    const supertokensId = req.session.getUserId();

    try {
        const updatedEmployee = await linkUserToEmployee(supertokensId);
        res.status(200).json({ message: "User linked to employee successfully", employee: updatedEmployee });
    } catch (error) {
        if (error.code === 'NOT_ONBOARDED' || error.code === 'ACCESS_REVOKED') {
            try {
                await req.session.revokeSession();
            } catch (revokeErr) {}
            return res.status(403).json({ message: error.message });
        }
        res.status(500).json({ message: "Failed to link user to employee", error: error.message });
    }
};

module.exports = { linkUserToEmployeeController };