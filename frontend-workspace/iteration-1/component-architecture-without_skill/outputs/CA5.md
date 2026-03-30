# CA5: What order should I structure the internals of a React component file?

A common convention is:
1. Imports at the top
2. Type definitions
3. The component function with hooks at the top
4. Helper functions
5. Export

Within the component, put your state and hooks first, then any derived values, event handlers, and finally the return statement with JSX. There's no strict rule — just be consistent within your project.
