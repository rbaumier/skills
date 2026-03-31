# Shadow / Elevation System

## CSS Custom Properties

```css
:root {
  /* Elevation levels */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);
  --shadow-2xl: 0 25px 50px rgba(0, 0, 0, 0.25);
}
```

## Usage

```css
/* Buttons */
.btn {
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.2s ease;
}
.btn:hover {
  box-shadow: var(--shadow-md);
}

/* Cards */
.card {
  box-shadow: var(--shadow-md);
  border-radius: 8px;
}

/* Dropdowns */
.dropdown {
  box-shadow: var(--shadow-lg);
  border-radius: 8px;
}

/* Modals */
.modal {
  box-shadow: var(--shadow-xl);
  border-radius: 12px;
}
```

## Hover Effect

```css
.card:hover {
  box-shadow: var(--shadow-lg);
  transition: box-shadow 0.3s ease;
}
```

This system provides a clear elevation hierarchy from flat elements up through modals, using consistent shadow values throughout your design system.
