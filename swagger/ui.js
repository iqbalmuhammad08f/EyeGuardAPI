/**
 * Menghasilkan HTML Swagger UI yang siap di-serve.
 * @param {string} specUrl - URL endpoint yang menyediakan OpenAPI JSON spec
 * @returns {string} HTML string
 */
const getSwaggerUIHtml = (specUrl = '/api-docs.json') => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EyeGuard Mobile API Docs</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui.min.css" />
    <style>
        body { margin: 0; }
        .swagger-ui .topbar { background-color: #1a1a2e; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-bundle.js" charset="UTF-8"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
    <script>
        window.onload = () => {
            window.ui = SwaggerUIBundle({
                url: '${specUrl}',
                dom_id: '#swagger-ui',
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                layout: "StandaloneLayout",
                deepLinking: true,
                displayRequestDuration: true,
            });
        };
    </script>
</body>
</html>`;

module.exports = { getSwaggerUIHtml };
