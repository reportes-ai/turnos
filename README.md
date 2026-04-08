# GesturnoS — Organizador de Turnos Ley 40 Horas 2026

Sistema de gestión de turnos para Chile, con motor de IA (Claude API) para análisis y optimización automática de horarios conforme a la Ley 21.561.

## Deploy en Vercel

1. Fork este repositorio
2. En Vercel: **New Project → Import Git Repository**
3. Agrega la variable de entorno:
   ```
   ANTHROPIC_API_KEY=sk-ant-xxxx
   ```
4. Deploy — sin configuración adicional

## Estructura

```
gesturnost/
├── public/
│   └── index.html      # App completa (single-file SPA)
├── vercel.json         # Config Vercel
└── README.md
```

## Funcionalidades

- Multi-empresa / multi-trabajador
- Scheduler legal: respeta jornada 42h (2026), descansos, horas extras
- Motor IA: analiza combinaciones y propone turnos óptimos via Claude API
- Documentos imprimibles: Aviso trabajador, Pacto Horas Extras, Resumen mensual
- Persistencia en localStorage (historial por mes)
- Alertas de cobertura insuficiente con recomendación contratar

## Normativa aplicada

- Ley 21.561 (40 Horas) — jornada 42h desde 26/04/2026
- Máx 2h extras/día, 12h extras/semana
- Descanso mínimo 12h entre jornadas
- Descanso semanal obligatorio (1 día cada 6)
- Banda horaria cuidadores (±1h)
- IMM $539.000 (enero 2026)
- Gratificación Art. 50: tope ~$213.437/mes
