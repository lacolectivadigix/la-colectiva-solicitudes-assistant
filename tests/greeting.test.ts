import { readFileSync } from 'fs'
import { join } from 'path'

// Verifica que el saludo inicial aprobado se mantenga EXACTO.
// Si alguien cambia el texto, esta prueba fallará.
describe('Saludo inicial aprobado', () => {
  test('PAISA_SALUDO permanece sin cambios', () => {
    const filePath = join(process.cwd(), 'src', 'app', 'api', 'ai', 'chat', 'route.ts')
    const file = readFileSync(filePath, 'utf-8')
    const match = file.match(/const\s+PAISA_SALUDO\s*=\s*([\s\S]*?);/)
    expect(match).toBeTruthy()
    const literal = match![1]
    expect(literal).toContain("¡Quiubo parce!")
    expect(literal).toContain("aquí pa\\'")
    expect(literal).toContain("¿para qué cliente es esta solicitud?")
  })
})