import { test, expect } from '@playwright/test';

test.describe('Fase 4: Multi-Agent RAG Orchestration Flow', () => {

  test('El usuario puede preguntar y presenciar los procesos de los agentes', async ({ page }) => {
    // 1. Acceder al dashboard principal interactivo
    await page.goto('/');

    // Verificar branding SaaS Factory
    await expect(page.locator('h1')).toContainText('SaaS Factory RAG');

    // 2. Localizar el input de texto del Generative UI
    const input = page.locator('input[placeholder*="Pregunta"]');
    await expect(input).toBeVisible();

    // 3. Simular la pregunta de un empleado buscando analíticas
    await input.fill('Generame un reporte sobre las mediciones gráficas recientes');
    await input.press('Enter');

    // 4. Validar las "Thought Process Animations" en tiempo real
    // Al menos uno de estos estados temporales de framer-motion debe renderizarse cuando el AI SDK emite un tool_call
    const thoughtProcess = page.getByText(/Analizando|Investigador consultando|Generando UI Anal[íi]tica|Auditor verificando/i);
    await expect(thoughtProcess.first()).toBeVisible({ timeout: 15000 });

    // 5. Validar Recepción y Decodificación del Mensaje Final
    // Tomando alrededor de 15-40s para el roundtrip con Claude 4.6 Sonnet
    const botMessage = page.locator('.bg-transparent.text-zinc-300 p').last();
    await expect(botMessage).toBeVisible({ timeout: 45000 });
  });

});
