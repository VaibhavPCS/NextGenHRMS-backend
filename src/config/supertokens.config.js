const supertokens = require('supertokens-node');
const Session = require('supertokens-node/recipe/session');
const Passwordless = require('supertokens-node/recipe/passwordless');

const initializeSupertokens = () => {
    supertokens.init({
        framework: "express",
        supertokens: {
            connectionURI: "http://127.0.0.1:3567",
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
                override: {
                    apis: (originalImplementation) => {
                        return {
                            ...originalImplementation,
                            consumeCodePOST: async (input) => {
                                const result = await originalImplementation.consumeCodePOST(input);

                                if (result.status === "INCORRECT_USER_INPUT_CODE_ERROR") {
                                    input.options.res.setStatusCode(401);
                                    input.options.res.sendJSONResponse({
                                        status: "INCORRECT_USER_INPUT_CODE_ERROR",
                                        error: "Incorrect OTP. Please try again.",
                                        failedCodeInputAttemptCount: result.failedCodeInputAttemptCount,
                                        maximumCodeInputAttempts: result.maximumCodeInputAttempts,
                                    });
                                    return result;
                                }

                                if (result.status === "EXPIRED_USER_INPUT_CODE_ERROR") {
                                    input.options.res.setStatusCode(401);
                                    input.options.res.sendJSONResponse({
                                        status: "EXPIRED_USER_INPUT_CODE_ERROR",
                                        error: "OTP has expired. Please request a new one.",
                                    });
                                    return result;
                                }

                                if (result.status === "RESTART_FLOW_ERROR") {
                                    input.options.res.setStatusCode(400);
                                    input.options.res.sendJSONResponse({
                                        status: "RESTART_FLOW_ERROR",
                                        error: "Session expired or OTP attempts exhausted. Please request a new OTP.",
                                    });
                                    return result;
                                }

                                return result;
                            },
                        };
                    },
                },
                smsDelivery: {
                    override: (originalImplementation) => {
                        return {
                            ...originalImplementation,
                            sendSms: async function (input) {
                                const mobile = input.phoneNumber;
                                const otp = input.userInputCode; 
                                const apiKey = process.env.TWO_FACTOR_API_KEY;
                                const url = `https://2factor.in/API/V1/${apiKey}/SMS/${mobile}/${otp}/OTP SEND`;
                                
                                try {
                                    const response = await fetch(url);
                                    const data = await response.json();
                                    if (data.Status === "Success") {
                                        console.log("SMS sent successfully");
                                    } else {
                                        console.error("2Factor API Rejected it:", data.Details);
                                    }
                                } catch (error) {
                                    console.error("Network Error hitting 2Factor API:", error);
                                }
                            }
                        }
                    }
                }
            }),
            Session.init()
        ]
    });
};

module.exports = { initializeSupertokens };