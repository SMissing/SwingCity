const nodemailer = require('nodemailer');

// Configure transporter using environment variables
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 465,
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * Send an email with a PNG image attachment
 * @param {string} to - recipient email
 * @param {string} imageDataUrl - data:image/png;base64,...
 * @returns {Promise}
 */
async function sendScoresEmail(to, imageDataUrl) {
    // Extract base64 from data URL
    const base64 = imageDataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: 'Your SwingCity Team Scores',
        text: 'Attached is your team scorecard from SwingCity.',
        attachments: [
            {
                filename: 'scores.png',
                content: buffer,
                contentType: 'image/png'
            }
        ]
    };
    return transporter.sendMail(mailOptions);
}

module.exports = sendScoresEmail;
