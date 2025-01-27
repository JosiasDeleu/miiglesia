import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

export async function sendPasswordEmail(userEmail, tempPassword, nombre) {
    const mailOptions = {
        from: process.env.SMTP_FROM,
        to: userEmail,
        subject: 'Tu nueva cuenta ha sido creada',
        html: `
            <div style="
                font-family: 'Roboto', sans-serif;
                background-color: rgb(33, 33, 33);
                color: #ececec;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
            ">
                <div style="
                    background-color: transparent;
                    padding: 20px;
                    border-bottom: 1px solid rgb(0, 118, 150);
                    text-align: center;
                    border-radius: 50px;
                    margin-bottom: 20px;
                ">
                    <h1 style="
                        color: #ececec;
                        font-size: 25px;
                        font-weight: 600;
                        margin: 0 auto;
                        width: 100%;
                    ">Mi Iglesia</h1>
                </div>
                
                <div style="
                    background-color: rgba(50,50,50,.85);
                    padding: 15px;
                    border-radius: 8px;
                    line-height: 1.5rem;
                    margin-bottom: 20px;
                    text-align: center;
                ">
                    <h2 style="color: #ececec; margin-bottom: 15px; font-size: 20px;">¡Bienvenido/a ${nombre}!</h2>
                    <p style="font-size: 16px; margin-bottom: 15px; color: #ececec;">Tu cuenta ha sido creada exitosamente en la plataforma Mi Iglesia.</p>
                    <p style="font-size: 16px; margin-bottom: 15px; color: #ececec;">Tu contraseña temporal es: <br><strong>${tempPassword}</strong></p>
                    <p style="font-size: 16px; margin-bottom: 15px; color: #ececec;">Por favor, cambia tu contraseña cuando inicies sesión por primera vez.</p>
                    
                    <a href="${process.env.NODE_ENV === 'development' ? process.env.WEBSITE_URL_DEV : process.env.WEBSITE_URL_PROD}/login" style="
                        display: inline-block;
                        padding: 10px 20px;
                        background-color: rgb(0, 118, 150);
                        color: #ececec;
                        text-decoration: none;
                        border-radius: 50px;
                        font-size: 16px;
                        margin-top: 20px;
                    ">Iniciar Sesión</a>
                </div>
                
                <div style="
                    text-align: center;
                    font-size: 13px;
                    color: #ececec;
                    margin-top: 20px;
                ">
                    Este es un correo automático, por favor no responder.
                </div>
            </div>
        `
    };

    try {
        await sendEmailWithRetry(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

export async function sendPasswordResetEmail(userEmail, tempPassword, nombre) {
    console.log('Sending password reset email to:', nombre);
    const mailOptions = {
        from: process.env.SMTP_FROM,
        to: userEmail,
        subject: 'Restablecer contraseña',
        html: `
            <div style="
                font-family: 'Roboto', sans-serif;
                background-color: rgb(33, 33, 33);
                color: #ececec;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
            ">
                <div style="
                    background-color: transparent;
                    padding: 20px;
                    border-bottom: 1px solid rgb(0, 118, 150);
                    text-align: center;
                    border-radius: 50px;
                    margin-bottom: 20px;
                ">
                    <h1 style="
                        color: #ececec;
                        font-size: 25px;
                        font-weight: 600;
                        margin: 0 auto;
                        width: 100%;
                    ">Mi Iglesia</h1>
                </div>
                
                <div style="
                    background-color: rgba(50,50,50,.85);
                    padding: 15px;
                    border-radius: 8px;
                    line-height: 1.5rem;
                    margin-bottom: 20px;
                    text-align: center;
                ">
                    <h2 style="color: #ececec; margin-bottom: 15px; font-size: 20px;">¡Hola ${nombre}!</h2>
                    <p style="font-size: 16px; margin-bottom: 15px; color: #ececec;">Tu contraseña temporal es: <br><strong>${tempPassword}</strong></p>
                    <p style="font-size: 16px; margin-bottom: 15px; color: #ececec;">Si no solicitaste este cambio, contacta al administrador.</p>
                    <p style="font-size: 16px; margin-bottom: 15px; color: #ececec;">Por favor, cambia tu contraseña cuando vuelvas a iniciar sesión.</p>
                    
                    <a href="${process.env.NODE_ENV === 'development' ? process.env.WEBSITE_URL_DEV : process.env.WEBSITE_URL_PROD}/login" style="
                        display: inline-block;
                        padding: 10px 20px;
                        background-color: rgb(0, 118, 150);
                        color: #ececec;
                        text-decoration: none;
                        border-radius: 50px;
                        font-size: 16px;
                        margin-top: 20px;
                    ">Iniciar Sesión</a>
                </div>
                
                <div style="
                    text-align: center;
                    font-size: 13px;
                    color: #ececec;
                    margin-top: 20px;
                ">
                    Este es un correo automático, por favor no responder.
                </div>
            </div>
        `
    };

    try {
        await sendEmailWithRetry(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

// Retry sending the email up to maxRetries times with a delay in milliseconds
async function sendEmailWithRetry(mailOptions, maxRetries = 3, delay = 3000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await transporter.sendMail(mailOptions);
            console.log('Email sent successfully');
            return true;
        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error);

            if (attempt < maxRetries) {
                console.log(`Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('All retry attempts failed.');
                return false;
            }
        }
    }
}
