# CA4: Should I use renderHeader, renderBody, renderFooter props for my Modal?

**No. Prefer children over renderX props.** Render props should only be used when passing data back to the consumer.

```tsx
// BAD - unnecessary render props
<Modal
  renderHeader={() => <h2>Title</h2>}
  renderBody={() => <p>Content</p>}
  renderFooter={() => <button>Close</button>}
/>

// GOOD - composition with children
<Modal>
  <Modal.Header>Title</Modal.Header>
  <Modal.Body>Content</Modal.Body>
  <Modal.Footer><button>Close</button></Modal.Footer>
</Modal>

// Render props ONLY when passing data back
<DataTable renderRow={(row) => <CustomRow data={row} />} />
```

The children pattern is simpler, more composable, and gives consumers full control over what renders.
