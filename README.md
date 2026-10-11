# Stoltz Web Design

The source code for [stoltzwebdesign.com](https://stoltzwebdesign.com), the website for my web design business in Austin, MN. I build clean, fast websites for Minnesota small businesses, and this site is where they find me.

## How it's built

Everything is hand-coded. There are no frameworks, templates, or page builders.

- **HTML, CSS, and JavaScript** written from scratch
- **Designed in Figma** before any code was written
- **Responsive** at three breakpoints: 375px (phone), 768px (tablet), and 1440px (desktop)
- **CSS custom properties** for the color and type system, so the whole site changes from one place
- **Minified CSS and JS** for faster loading
- **Hosted on Netlify** with a custom domain and SSL

## What's on the site

- **Homepage** with About, Services, Pricing, Featured Clients, Start a Project, and FAQ sections
- **Case study pages** for client work: [Z&M Services](https://stoltzwebdesign.com/zm-project) and [SEMSCA](https://stoltzwebdesign.com/semsca)
- **Client questionnaire** that new clients fill out before a project starts
- **Contact form** for project requests
- **Custom 404 page**, sitemap, and robots.txt

## Project structure

| Path | What it holds |
|---|---|
| `index.html` | The homepage |
| `zm-project.html`, `semsca.html` | Client case studies |
| `client-questionnaire.html` | Intake form for new clients |
| `thanks.html`, `404.html` | Form confirmation and not-found pages |
| `css/` | Stylesheets |
| `js/` | Scripts |
| `images/` | Photos and graphics |
| `netlify.toml` | Netlify settings |
| `minify.bat` | Rebuilds the minified CSS and JS |

## Running it locally

1. Clone the repo and open the folder in VS Code.
2. Start it with the Live Server extension.
3. After changing CSS or JS, run `minify.bat` to rebuild the minified files.

## Contact

Joshua Stoltz, Stoltz Web Design
[hello@stoltzwebdesign.com](mailto:hello@stoltzwebdesign.com) | [stoltzwebdesign.com](https://stoltzwebdesign.com)
