/** Mensagens de validação do Zod em português do Brasil (importar uma vez em cada lado). */
import { z } from "zod";

z.config(z.locales.ptBR());

export { z };
