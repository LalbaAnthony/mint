export type HealthDependencies = {
  checkDatabase: () => Promise<boolean>
}

export type AppDependencies = HealthDependencies
