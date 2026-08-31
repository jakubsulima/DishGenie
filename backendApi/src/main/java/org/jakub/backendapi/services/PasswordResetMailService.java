package org.jakub.backendapi.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class PasswordResetMailService {
    private static final Logger log = LoggerFactory.getLogger(PasswordResetMailService.class);

    private final JavaMailSender mailSender;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Value("${spring.mail.username:no-reply@dishgenie.app}")
    private String fromAddress;

    public PasswordResetMailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendPasswordReset(String email, String token, String locale) {
        boolean polish = "pl".equalsIgnoreCase(locale);
        String resetUrl = frontendUrl + "/reset-password?token=" + token;
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(email);
        message.setSubject(polish ? "Zresetuj hasło w Dish Genie" : "Reset your Dish Genie password");
        message.setText(polish
                ? "Otwórz poniższy link, aby ustawić nowe hasło. Link wygasa za 30 minut:\n\n" + resetUrl
                : "Open the link below to choose a new password. The link expires in 30 minutes:\n\n" + resetUrl);

        try {
            mailSender.send(message);
        } catch (MailException exception) {
            log.error("Could not send a password-reset email", exception);
        }
    }
}
