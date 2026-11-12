package cl.duoc.productos.config;

import cl.transbank.common.IntegrationApiKeys;
import cl.transbank.common.IntegrationCommerceCodes;
import cl.transbank.webpay.webpayplus.WebpayPlus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TransbankConfiguration {

    @Bean
    WebpayPlus.Transaction webpayPlusTransaction(
            @Value("${transbank.environment}") String environment,
            @Value("${transbank.commerce-code}") String commerceCode,
            @Value("${transbank.api-key}") String apiKey) {
        if ("integration".equalsIgnoreCase(environment)) {
            return WebpayPlus.Transaction.buildForIntegration(
                    IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY);
        }
        if ("production".equalsIgnoreCase(environment)) {
            if (commerceCode.isBlank() || apiKey.isBlank()) {
                throw new IllegalStateException(
                        "TRANSBANK_COMMERCE_CODE y TRANSBANK_API_KEY son obligatorios en producción");
            }
            return WebpayPlus.Transaction.buildForProduction(commerceCode, apiKey);
        }
        throw new IllegalStateException("TRANSBANK_ENVIRONMENT debe ser integration o production");
    }
}
