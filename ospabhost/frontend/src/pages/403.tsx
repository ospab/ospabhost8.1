import ErrorPage from '../components/ErrorPage';

export default function Forbidden() {
  return (
    <ErrorPage
      code="403"
      title="Доступ запрещён"
      description="У вас недостаточно прав для доступа к этой странице. Обратитесь к администратору, если считаете это ошибкой."
      icon={
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      }
      color="purple"
      showLoginButton={false}
      showBackButton={true}
      showHomeButton={true}
    />
  );
}
