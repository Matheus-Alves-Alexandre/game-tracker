# Home and visual system

The home uses an original warm coral/burgundy feature surface with the existing dark library shell. The supplied reference informs composition: navigation rail, featured game, compact library cards and a statistics sidebar. Its logos, game assets, promotional copy and fictional metrics are not copied.

The featured game prioritizes Playing, then Planned. Top-rated games use the owner's ratings. Recently completed games require an actual completion date and sort by that date; missing dates are not invented. Every card opens the existing edit popup. Status changes remain in that popup, following the maintainer's preference.

Platinum percentage is achieved games divided by active games whose platinum field is not Not applicable. With no eligible games, show an unavailable marker rather than a fabricated zero. The UI states the numerator and denominator. Total playtime is the sum of recorded lifetime durations, with coverage shown separately; it is not monthly activity. Archived games are excluded. Personal scores and IGDB community ratings remain distinct.

## UI resources reviewed

- [Lucide React](https://lucide.dev/guide/react/): adopted for individual SVG icons. Named imports let the bundler retain only used icons; ISC license.
- [Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction): reference for future accessible controls; not installed in this increment. Existing modal behavior is covered by renderer and native tests, but no complete screen-reader certification is claimed.
- [shadcn/ui charts](https://ui.shadcn.com/docs/components/aria/chart): reviewed as a future chart option. Not installed for the single percentage ring; CSS plus visible numeric text is sufficient here.

Keep typography local, avoid continuous animations and load only selected/visible cover images. The complete app's workload memory benchmarks remain pending; a small JavaScript bundle alone does not establish RAM usage.
