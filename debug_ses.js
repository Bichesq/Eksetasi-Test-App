const AWS = require('aws-sdk');

AWS.config.update({region: 'us-east-1'});
const ses = new AWS.SES();

const sender = "admin@dev.project-penguin.com";
const recipient = "bichesq@gmail.com";
const subject = "Test Subject";
const body = "Test Body";

async function sendEmail() {
    const params = {
        Source: sender,
        Destination: { ToAddresses: [recipient] },
        Message: {
            Subject: { Data: subject },
            Body: { Text: { Data: body } }
        }
    };

    console.log(`Sending from ${sender} to ${recipient}...`);
    try {
        const data = await ses.sendEmail(params).promise();
        console.log("Success! MessageId:", data.MessageId);
    } catch (err) {
        console.error("FAILED:");
        console.error(err);
    }
}

sendEmail();
