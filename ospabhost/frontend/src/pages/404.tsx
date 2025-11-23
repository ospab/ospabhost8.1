import ErrorPage from '../components/ErrorPage';

export default function NotFound() {
  return (
    <ErrorPage
      code="404"
      title="Страница не найдена"
      description="К сожалению, запрашиваемая страница не существует или была перемещена."
      icon={
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      color="blue"
      showLoginButton={false}
      showBackButton={true}
      showHomeButton={true}
    />
  );
}
