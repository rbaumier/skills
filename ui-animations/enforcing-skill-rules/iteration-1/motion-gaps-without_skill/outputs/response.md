# Response: Adding Animations to Dashboard

Here's how I'd approach adding animations to your React dashboard:

## Modals

Use Framer Motion's `AnimatePresence` for smooth modal enter/exit:

```tsx
import { motion, AnimatePresence } from 'framer-motion';

function Modal({ isOpen, onClose, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

## Tabs

For tab content, you can fade between panels:

```tsx
function TabPanel({ activeTab, children }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

## Settings Panel

For conditional controls in settings, use a simple height animation or just fade them in/out when toggled:

```tsx
{showAdvanced && (
  <motion.div
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: 'auto' }}
    exit={{ opacity: 0, height: 0 }}
  >
    <AdvancedSettings />
  </motion.div>
)}
```

This approach covers the main areas where things appear/disappear and makes the UI feel polished.
