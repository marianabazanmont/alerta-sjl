# Backlog de AlertaSJL

## Épicas

| ID | Épica | Descripción | Objetivo de negocio |
|---|---|---|---|
| E1 | Mapa de zonas de riesgo | Visualización georreferenciada de las zonas, calles y horarios de mayor incidencia delictiva en San Juan de Lurigancho, con filtros por tipo de delito y franja horaria. | Que vecinos y visitantes conozcan las zonas de riesgo y eviten exponerse, reduciendo la probabilidad de ser víctimas de robos y asaltos. |
| E2 | Reportes ciudadanos | Canal único para que los vecinos reporten incidentes (robo, asalto en transporte, extorsión, microcomercialización), incluso de forma anónima, con ubicación exacta. | Centralizar los reportes que hoy quedan dispersos en redes sociales para que lleguen al serenazgo y a la comisaría. |
| E3 | Gestión y atención de incidentes | Bandeja para operadores de serenazgo que permite priorizar, atender, cambiar el estado y derivar reportes a la comisaría correspondiente. | Reducir el tiempo de respuesta ante incidentes y dar trazabilidad a cada reporte. |
| E4 | Autenticación y seguridad | Inicio de sesión, roles y controles de seguridad (JWT, bcrypt, limitación de intentos) que protegen el panel y los datos de los denunciantes. | Garantizar que solo personal autorizado gestione incidentes y proteger la identidad de los vecinos frente a represalias. |
| E5 | Analítica y alertas | Estadísticas por tipo de delito, estado y franja horaria, y alertas al ciudadano cuando se encuentra en una zona de alto riesgo. | Apoyar la planificación del patrullaje con datos y prevenir delitos alertando a tiempo. |

## Historias de usuario

| ID | Épica | Historia | SP | MoSCoW | Sprint |
|---|---|---|---|---|---|
| HU01 | E4 | Como operador de serenazgo, quiero iniciar sesión con usuario y contraseña, para acceder de forma segura al panel de gestión de incidentes | 5 | Must | S1→S2 |
| HU02 | E4 | Como administrador, quiero asignar roles (operador, administrador) a los usuarios, para controlar quién puede gestionar los reportes | 5 | Should | S3 |
| HU03 | E1 | Como vecino de SJL, quiero ver un mapa del distrito con las zonas de riesgo coloreadas por nivel, para evitar transitar por las zonas más peligrosas | 8 | Must | S1 |
| HU04 | E1 | Como vecino de SJL, quiero filtrar las zonas por tipo de delito, para conocer el riesgo específico que me preocupa (robo, extorsión, etc.) | 3 | Should | S2→S3 |
| HU05 | E1 | Como visitante del distrito, quiero filtrar las zonas por franja horaria, para planificar a qué hora es más seguro transitar | 3 | Should | S3 |
| HU06 | E1 | Como vecino de SJL, quiero ver el detalle de una zona (nivel, delitos frecuentes y horario crítico), para informarme antes de pasar por ella | 2 | Could | S3 |
| HU07 | E2 | Como vecino de SJL, quiero registrar un reporte de incidente con tipo, ubicación y descripción, para alertar al serenazgo y a la comisaría | 8 | Must | S1 |
| HU08 | E2 | Como vecino víctima de extorsión, quiero reportar de forma anónima, para no exponerme a represalias | 3 | Must | S2 |
| HU09 | E2 | Como vecino de SJL, quiero marcar la ubicación del incidente con un clic en el mapa, para precisar dónde ocurrió sin escribir coordenadas | 5 | Should | S2 |
| HU10 | E2 | Como vecino de SJL, quiero ver los reportes recientes de mi distrito, para estar al tanto de lo que ocurre cerca | 3 | Should | S2 |
| HU11 | E3 | Como operador de serenazgo, quiero ver la bandeja de reportes filtrada por estado y tipo, para priorizar la atención de incidentes | 5 | Must | S2 |
| HU12 | E3 | Como operador de serenazgo, quiero cambiar el estado de un reporte (Nuevo, En atención, Atendido, Descartado), para dar seguimiento y trazabilidad a cada incidente | 5 | Must | S3 |
| HU13 | E3 | Como operador de serenazgo, quiero derivar un reporte a la comisaría correspondiente, para coordinar la respuesta con la PNP | 5 | Could | S4 |
| HU14 | E5 | Como jefe de serenazgo, quiero ver estadísticas de reportes por tipo de delito, estado y franja horaria, para planificar el patrullaje según datos | 5 | Should | S3 |
| HU15 | E5 | Como vecino de SJL, quiero recibir una alerta cuando me encuentro en una zona de alto riesgo, para tomar precauciones a tiempo | 8 | Could | S4 |
| HU16 | E5 | Como jefe de serenazgo, quiero exportar los reportes a CSV, para compartirlos con la comisaría | 3 | Won't | — |
| HU17 | E4 | Como responsable de seguridad de la municipalidad, quiero que el sistema limite los intentos de login y aplique cabeceras de seguridad, para prevenir ataques de fuerza bruta, XSS y spam de reportes falsos | 5 | Should | S4 |

## Criterios de aceptación

**HU01**
- Dado que tengo credenciales válidas, cuando inicio sesión, entonces accedo al panel y recibo un token con vigencia de 2 horas.
- Dado que ingreso una contraseña incorrecta, cuando intento ingresar, entonces veo «Credenciales inválidas» sin indicar qué dato falló.

**HU02**
- Dado que soy administrador, cuando asigno el rol operador a un usuario, entonces ese usuario puede ver la bandeja de reportes.
- Dado que un usuario sin rol de staff llama a la bandeja, cuando envía la petición, entonces recibe 403 Permisos insuficientes.

**HU03**
- Dado que abro la aplicación, cuando carga el mapa, entonces veo las zonas en rojo (alto), naranja (medio) y amarillo (bajo).
- Dado que veo el mapa, cuando reviso la leyenda, entonces entiendo qué significa cada color.

**HU04**
- Dado que estoy en el mapa, cuando selecciono «Extorsión», entonces solo se muestran las zonas con ese delito.
- Dado que envío un tipo inexistente a la API, cuando se procesa, entonces recibo 400 Tipo inválido.

**HU05**
- Dado que estoy en el mapa, cuando elijo «Noche (18-24)», entonces veo solo las zonas críticas en ese horario.
- Dado que quito el filtro, cuando selecciono «Todas», entonces vuelven a mostrarse todas las zonas.

**HU06**
- Dado que veo una zona en el mapa, cuando hago clic sobre ella, entonces se muestra su nombre, nivel, delitos y horario crítico.
- Dado que consulto una zona inexistente, cuando llamo a la API, entonces recibo 404.

**HU07**
- Dado que completo tipo, ubicación dentro de SJL y una descripción de 10 a 280 caracteres, cuando envío, entonces el reporte se registra con estado «Nuevo».
- Dado que la ubicación está fuera de SJL, cuando envío, entonces veo un mensaje de error y no se registra.

**HU08**
- Dado que dejo marcada la opción «Anónimo», cuando envío, entonces no se guarda ningún dato de contacto.
- Dado que consulto la lista pública de reportes, cuando se muestra, entonces nunca aparece el celular del denunciante.

**HU09**
- Dado que estoy en el mapa, cuando hago clic en un punto, entonces se coloca un marcador y se llenan la latitud y longitud del formulario.
- Dado que uso «mi ubicación», cuando acepto el permiso del navegador, entonces se completan las coordenadas automáticamente.

**HU10**
- Dado que abro el mapa, cuando cargan los reportes, entonces veo los últimos 50 ordenados del más reciente al más antiguo.
- Dado que veo un reporte, cuando reviso su información, entonces veo tipo, estado, descripción y fecha.

**HU11**
- Dado que inicié sesión como operador, cuando abro la bandeja, entonces veo todos los reportes con su contacto (si no es anónimo).
- Dado que no tengo token, cuando intento ver la bandeja, entonces recibo 401.

**HU12**
- Dado un reporte «Nuevo», cuando lo paso a «En atención», entonces se guarda el cambio con mi usuario y la fecha en el historial.
- Dado un reporte «Nuevo», cuando intento pasarlo directo a «Atendido», entonces el sistema lo rechaza (422).

**HU13**
- Dado un reporte, cuando selecciono la comisaría «Bayóvar», entonces queda derivado y registrado en el historial.
- Dado que envío una comisaría que no existe, cuando se procesa, entonces recibo 400.

**HU14**
- Dado que existen reportes, cuando abro Estadísticas, entonces veo el total y los conteos por tipo, estado y franja.
- Dado que se registra un nuevo reporte, cuando actualizo, entonces las cifras se recalculan.

**HU15**
- Dado que comparto mi ubicación y estoy dentro del radio de una zona de alto riesgo, cuando consulto, entonces veo una alerta en rojo con el nombre de la zona.
- Dado que estoy fuera de toda zona de alto riesgo, cuando consulto, entonces el sistema me indica que no estoy en zona de alto riesgo.

**HU16**
- Dado que estoy en la bandeja, cuando presiono «Exportar», entonces se descarga un CSV con los reportes filtrados.
- Dado que no tengo rol de staff, cuando intento exportar, entonces recibo 403.

**HU17**
- Dado que fallo 5 veces el login en un minuto, cuando lo intento de nuevo, entonces recibo «Demasiados intentos, espere un minuto».
- Dado cualquier respuesta del servidor, cuando la inspecciono, entonces incluye Content-Security-Policy y no incluye X-Powered-By.

## Sprints

| Sprint | Fechas | Sprint goal | Sprint backlog | SP comprometidos | SP completados |
|---|---|---|---|---|---|
| Sprint 1 | 07/09 – 18/09/2026 | MVP navegable: el vecino ve el mapa de zonas de riesgo y registra un reporte; el operador puede autenticarse. | HU01, HU03, HU07 | 21 | 16 |
| Sprint 2 | 21/09 – 02/10/2026 | Reportes ciudadanos completos (anónimos, con ubicación en mapa) y bandeja de atención para serenazgo. | HU01, HU04, HU08, HU09, HU10, HU11 | 24 | 21 |
| Sprint 3 | 05/10 – 16/10/2026 | Gestión del ciclo de vida del incidente, roles y analítica para planificar el patrullaje. | HU02, HU04, HU05, HU06, HU12, HU14 | 23 | 23 |
| Sprint 4 | 19/10 – 30/10/2026 | Coordinación con comisarías, alertas de cercanía y endurecimiento de seguridad para el Release 1.0. | HU13, HU15, HU17 | 18 | 18 |

Velocidad por sprint: [16, 21, 23, 18] · Velocidad promedio: 19.50 SP/sprint