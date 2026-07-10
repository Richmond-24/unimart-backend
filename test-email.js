require('dotenv').config();
const nodemailer = require('nodemailer');

const createTransporter = () => {
    const rawPass = process.env.EMAIL_PASSWORD || '';
    const cleanPass = rawPass.replace(/\s+/g, '');
    console.log(`Connecting to smtp.gmail.com:465 with user: ${process.env.EMAIL_USER}`);
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: cleanPass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
    });
};

const transporter = createTransporter();

const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@unimart.com',
    to: 'richmondjohnson948@gmail.com', // test email
    subject: 'Test Email from UniMart SSL',
    text: 'This is a test email to verify SSL SMTP configuration.',
};

console.log("Sending email...");
transporter.sendMail(mailOptions)
    .then(info => {
        console.log("SUCCESS! Email sent successfully:", info.messageId);
        process.exit(0);
    })
    .catch(err => {
        console.error("FAILURE! Error sending email:", err);
        process.exit(1);
    });
