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