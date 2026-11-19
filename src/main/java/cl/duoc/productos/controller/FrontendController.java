package cl.duoc.productos.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class FrontendController {

    @GetMapping("/pago/resultado")
    public String resultadoPago() {
        return "forward:/index.html";
    }
}
