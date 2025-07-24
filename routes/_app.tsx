import { PageProps } from "$fresh/server.ts";

export default function App({ Component }: PageProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Asura - Modern Manga Reader</title>
        
        {/* FontAwesome Icons */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        
        {/* Tailwind CSS CDN as fallback */}
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #0f172a, #1e40af, #7c3aed); min-height: 100vh; color: white; font-family: system-ui, -apple-system, sans-serif;">
        <Component />
      </body>
    </html>
  );
}