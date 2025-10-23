# Bonsai Build System Documentation

Complete index of the build system documentation.

## 📚 Available Documents

### Main Documentation

- **[BUILD.md](./BUILD.md)** - Build system overview (FR)
- **[BUILD-EN.md](./BUILD-EN.md)** - Build system overview (EN)

### Technical Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed technical architecture (FR)
- **[DEVELOPER-GUIDE.md](./DEVELOPER-GUIDE.md)** - Developer practical guide (FR)
- **[DEVELOPER-GUIDE-EN.md](./DEVELOPER-GUIDE-EN.md)** - Developer practical guide (EN)

### Specialized Documentation

- **[cache/CACHE.md](./build/cache/CACHE.md)** - Build cache system

## 🚀 Quick Start

### New Developers

1. Read [BUILD-EN.md](./BUILD-EN.md) to understand concepts
2. Consult [DEVELOPER-GUIDE-EN.md](./DEVELOPER-GUIDE-EN.md) for practice
3. Reference [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details

### Contributing to Build System

1. Understand architecture in [ARCHITECTURE.md](./ARCHITECTURE.md)
2. Follow best practices from [DEVELOPER-GUIDE-EN.md](./DEVELOPER-GUIDE-EN.md)
3. Test modifications according to guidelines

## 🏗️ System Architecture

```
Bonsai Build System
├── Automatic package detection
│   ├── Regular packages (TypeScript + Rollup)
│   └── Types-only packages (direct .d.ts copy)
├── Incremental build with cache
├── Library parallelization
└── Unified framework bundle
```

## 📋 Package Creation Checklist

### Regular Package

- [ ] Correct folder structure
- [ ] `package.json` with appropriate exports
- [ ] TypeScript source code
- [ ] Added to `bonsai-components.yaml`
- [ ] Unit tests

### Types-only Package

- [ ] `package.json` with only `exports.types`
- [ ] `.d.ts` files in `/src`
- [ ] No executable code
- [ ] Added to `bonsai-components.yaml`
- [ ] Type validation

## 🔧 Useful Commands

```bash
# Complete build
pnpm run build

# Build with cleanup
pnpm run build:clean

# Detailed logs
DEBUG=bonsai:build pnpm run build

# Tests
npm test
```

## 🐛 Quick Troubleshooting

| Problem                            | Solution                                        |
| ---------------------------------- | ----------------------------------------------- |
| Package not detected as types-only | Check `package.json` and `/src` content         |
| TypeScript errors                  | Manually compile with `npx tsc`                 |
| Corrupted cache                    | `pnpm run build:clean && rm -rf .bonsai-cache/` |
| Slow build                         | Check if packages can be types-only             |

## 📊 Performance Metrics

The system automatically displays:

- ⚡ Cache hits (unmodified packages)
- 📝 Types-only detection
- 🔨 Build time per package
- 🏁 Total build time

## 🤝 Contributing

To contribute to the build system:

1. **Fork and clone** the repository
2. **Read technical documentation**
3. **Create a branch** for your modifications
4. **Test** your changes
5. **Submit a PR** with detailed description

## 📞 Support

- **GitHub Issues**: For bugs and feature requests
- **Documentation**: This section for usage questions
- **Source code**: `/lib/build/` for implementation

---

> 💡 **Note**: This documentation evolves with the system. Feel free to propose improvements!
