# Chat Orchestrator (Prompt-Based)

Objetivo: centralizar la lógica conversacional del chat en un único prompt mantenible, dejando el código como un wrapper que pasa contexto y aplica el resultado.

Estados soportados:
- INICIAL
- ESPERANDO_CONFIRMACION_COTIZACION
- ESPERANDO_ACK_PREGUNTAS
- ESPERANDO_CLIENTE
- ESPERANDO_SERVICIO
- ESPERANDO_TIPO_SERVICIO
- ESPERANDO_RESPUESTAS_BRIEF
- ESPERANDO_LINK_DISEÑO
- ESPERANDO_OBSERVACIONES
- FINALIZANDO

Salida JSON esperada:
```
{
  "intent": "affirm|decline|interrupt|smalltalk|other",
  "current_step": "<estado actual>",
  "next_step": "<estado siguiente o igual>",
  "assistant_message": "<respuesta lista para UI>",
  "tone": { "formality": "formal|neutral|informal", "register": "paisa|neutral" },
  "require_confirmation": false
}
```

Reglas clave:
- Afirmación natural avanza sin confirmar redundante.
- Interrupciones y smalltalk responden cálidos sin mover estado.
- Tono paisa cuando el usuario es informal; formal/neutral en lo contrario.

Operativa:
- El orquestador (`src/lib/ai/prompt_orchestrator.ts`) construye el prompt, llama al modelo y valida JSON.
- `route.ts` usa el orquestador para los pasos iniciales, preservando integraciones (Supabase, email, login).

Próximos pasos planificados:
- Extender orquestación a pasos de cliente/servicio/brief con extracción de entidades.
- Versionar prompts y añadir tests de validación.