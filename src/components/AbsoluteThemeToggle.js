import ThemeToggle from './ThemeToggle';

export default function AbsoluteThemeToggle() {
  return (
    <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 100 }}>
      <ThemeToggle />
    </div>
  );
}
