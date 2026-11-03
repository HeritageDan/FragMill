# Test Fixtures & Sample Outputs

This directory contains test fixtures and local inspection artifacts for the test suites.

## Regenerating Sample Study Reports

To generate fresh sample Word (`.docx`) and PDF (`.pdf`) study reports for manual review and inspection:

```bash
npm test
```

During test execution, `src/geolab/studies/studyEngine.test.ts` compiles a comprehensive sample study document (3 analyses, 12 photos, full approval chain, revisions, and curves) and writes:

- `tests/.output/study_sample.docx`
- `tests/.output/study_sample.pdf`

Both documents are automatically watermarked/footered with:
`SAMPLE - fictional data`

The `tests/.output/` folder is gitignored to avoid checking large binary artifacts into version control.

