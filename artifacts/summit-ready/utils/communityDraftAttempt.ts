export class CommunityDraftAttempt {
  private current: {owner:string;draft:string;id:string}|null = null;
  constructor(private newId:()=>string) {}
  acquire(owner:string,draft:string): string {
    if (this.current?.owner!==owner || this.current.draft!==draft)
      this.current={owner,draft,id:this.newId()};
    return this.current.id;
  }
  acknowledge(id:string): void { if(this.current?.id===id)this.current=null; }
  reset(): void { this.current=null; }
}
