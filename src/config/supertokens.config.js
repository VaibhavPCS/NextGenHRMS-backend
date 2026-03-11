const supertokens = require('supertokens-node');
const Session = require('supertokens-node/recipe/session');
const Passwordless = require('supertokens-node/recipe/passwordless');
const logger = require('../utils/logger');

const initializeSupertokens = () => {
    supertokens.init({
        framework: "express",
        supertokens: {
            // Use env var so this works in Docker/staging/prod without code changes
            connectionURI: process.env.SUPERTOKENS_URI || "http://127.0.0.1:3567",
        },
        appInfo: {
            appName: "NextGenHRMS",
            apiDomain: process.env.BACKEND_URL,
            websiteDomain: process.env.FRONTEND_URL,
            apiBasePath: "/auth",
            websiteBasePath: "/auth"
        },
        recipeList: [
            Passwordless.init({
                contactMethod: "PHONE",
                flowType: "USER_INPUT_CODE",
                smsDelivery: {
                    override: (originalImplementation) => {
                        return {
                            ...originalImplementation,
                            sendSms: async function (input) {
                                const apiKey = process.env.TWO_FACTOR_API_KEY;

                                // encodeURIComponent converts +91XXXXXXXXXX → %2B91XXXXXXXXXX
                                // OTP%20SEND encodes the space — raw spaces throw TypeError in fetch
                                const encodedMobile = encodeURIComponent(input.phoneNumber);
                                const url = `https://2factor.in/API/V1/${apiKey}/SMS/${encodedMobile}/${input.userInputCode}/OTP%20SEND`;

                                try {
                                    const response = await fetch(url);

                                    // Always check response.ok before parsing JSON
                                    if (!response.ok) {
                                        logger.error({
                                            event: 'SMS_GATEWAY_HTTP_ERROR',
                                            status: response.status,
                                        }, '2Factor API returned non-2xx status');
                                        return;
                                    }

                                    const data = await response.json();

                                    if (data.Status === "Success") {
                                        logger.info({ event: 'SMS_SENT' }, 'OTP SMS dispatched successfully');
                                    } else {
                                        logger.error({
                                            event: 'SMS_GATEWAY_REJECTED',
                                            details: data.Details,
                                        }, '2Factor API rejected the SMS request');
                                    }
                                } catch (error) {
                                    logger.error({
                                        event: 'SMS_GATEWAY_NETWORK_ERROR',
                                        err: error,
                                    }, 'Network error reaching 2Factor API');
                                }
                            }
                        };
                    }
                }
            }),
            Session.init()
        ]
    });
};

module.exports = { initializeSupertokens };
