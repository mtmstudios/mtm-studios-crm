

# Mobile-Optimierung MTM CRM

## Überblick
Alle Seiten werden für mobile Geräte (< 768px) optimiert. Die App hat bereits grundlegende responsive Klassen, aber es gibt mehrere Bereiche mit Verbesserungspotenzial.

## Änderungen

### 1. Dashboard (`Dashboard.tsx`)
- KPI-Karten: `grid-cols-2` statt `grid-cols-1` auf Mobile für kompaktere Darstellung
- Chart-Höhe auf Mobile reduzieren (180px statt 220px)
- Voice Leads Cards auf Mobile als einzelne Spalte mit kompakterem Padding

### 2. Kontaktliste (`ContactList.tsx`)
- Filter-Selects auf Mobile volle Breite (`w-full` statt `w-[150px]`)
- Tabelle auf Mobile durch eine Card-basierte Liste ersetzen (Name + Status pro Card) — responsive Ansicht statt overflow-scroll

### 3. Unternehmensliste (`CompanyList.tsx`)
- Gleiche Filter-Optimierung wie Kontakte
- Card-basierte Mobile-Ansicht statt Tabelle

### 4. Deal Pipeline (`DealPipeline.tsx`)
- Kanban-Spalten: `min-w-[160px]` statt `min-w-[200px]` auf Mobile
- Horizontales Scrollen beibehalten, aber Snap-Scrolling hinzufügen
- DealCard kompakteres Padding auf Mobile

### 5. Aktivitätenliste (`ActivityList.tsx`)
- TabsList auf Mobile horizontal scrollbar machen
- Activity-Cards: Stack-Layout auf Mobile (Icon + Text vertikal)

### 6. Voice Leads (`VoiceLeads.tsx`)
- Header: Titel und Filter auf Mobile übereinander (flex-col)

### 7. Detail-Seiten (Contact, Company, Deal)
- Tabs auf Mobile horizontal scrollbar
- Formulare: `grid-cols-1` statt `grid-cols-2` auf kleinen Screens
- Info-Grids auf Mobile einspaltiges Layout

### 8. Auth-Seite (`Auth.tsx`)
- Bereits gut optimiert, nur minimale Padding-Anpassung

### 9. Dialoge
- Alle `DialogContent` bekommen `max-h-[90vh] overflow-y-auto` für Mobile
- Form-Grids in Dialogen: `grid-cols-1` auf Mobile

## Technische Details
- Alle Änderungen nutzen Tailwind responsive Prefixe (`sm:`, `md:`, `lg:`)
- Keine neuen Abhängigkeiten nötig
- Betrifft ca. 10 Dateien mit reinen CSS-Klassen-Anpassungen

