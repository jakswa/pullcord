/**
 * Shared error / 404 page — standalone (no Layout wrapper).
 * Matches the app's dark theme so errors don't flash a jarring light page.
 */
export interface ErrorPageProps {
  title: string;
  heading: string;
  message: string;
  showHomeLink?: boolean;
}

export const ErrorPage = ({ title, heading, message, showHomeLink = true }: ErrorPageProps) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title}</title>
      <style>{`
        body {
          font-family: system-ui, -apple-system, sans-serif;
          text-align: center;
          padding: 50px 20px;
          margin: 0;
          background: #0f0f0f;
          color: #e5e5e5;
        }
        .error {
          max-width: 400px;
          margin: 0 auto;
        }
        h1 {
          color: #f87171;
          font-size: 1.5rem;
          margin-bottom: 0.75rem;
        }
        p {
          color: #a3a3a3;
          margin: 16px 0;
          line-height: 1.5;
        }
        a {
          color: #60a5fa;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
      `}</style>
    </head>
    <body>
      <div class="error">
        <h1>{heading}</h1>
        <p>{message}</p>
        {showHomeLink && <p><a href="/">&larr; Back to Home</a></p>}
      </div>
    </body>
  </html>
);
